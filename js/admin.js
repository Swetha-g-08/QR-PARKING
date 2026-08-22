// js/admin.js
let activeTab = 'tab-overview';
let currentSlots = [];
let slotToDelete = null;

document.addEventListener('DOMContentLoaded', async () => {
    const profile = await checkAuthAndRole('admin');
    if (profile) {
        setupNavigation();
        await refreshAllData();
    }
});

function setupNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = item.getAttribute('data-tab');
            if (targetTab) switchTab(targetTab);
        });
    });
}

function switchTab(tabId) {
    if (tabId === activeTab) return;
    
    // Update active nav
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
        if (el.getAttribute('data-tab') === tabId) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    // Update active pane
    document.querySelectorAll('.tab-pane').forEach(el => {
        if (el.id === tabId) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
    
    activeTab = tabId;
}

async function refreshAllData() {
    await loadStats();
    await loadAdminSlots();
    await loadStudents();
    await loadActiveSessions();
    await loadHistory();
}

async function loadStats() {
    try {
        const { data: slots, error: slotsError } = await supabase.from('parking_slots').select('status');
        if (slotsError) throw slotsError;
        
        document.getElementById('statTotal').textContent = slots.length;
        document.getElementById('statAvailable').textContent = slots.filter(s => s.status === 'available').length;
        document.getElementById('statOccupied').textContent = slots.filter(s => s.status === 'occupied').length;

        const { data: activeLogs, error: logsError } = await supabase.from('access_logs').select('id').eq('status', 'active');
        if (logsError) throw logsError;
        document.getElementById('statActiveSessions').textContent = activeLogs.length;
    } catch (err) { console.error(err); }
}

async function loadAdminSlots() {
    try {
        const { data: slots, error } = await supabase.from('parking_slots').select('*').order('slot_number');
        if (error) throw error;
        currentSlots = slots;
        renderSlots(slots);
    } catch (err) { console.error(err); }
}

function filterSlots(statusFilter) {
    const select = document.getElementById('slotFilter');
    if (select.value !== statusFilter) select.value = statusFilter;
    
    if (statusFilter === 'all') {
        renderSlots(currentSlots);
    } else {
        const filtered = currentSlots.filter(s => s.status === statusFilter);
        renderSlots(filtered);
    }
}

function renderSlots(slots) {
    const container = document.getElementById('adminSlotsContainer');
    container.innerHTML = '';
    
    if (slots.length === 0) {
        container.innerHTML = '<p class="muted">No slots match the current filter.</p>';
        return;
    }

    const grouped = {};
    slots.forEach(slot => {
        const match = slot.slot_number.match(/^[a-zA-Z]+/);
        const prefix = match ? match[0].toUpperCase() : 'Other';
        if (!grouped[prefix]) grouped[prefix] = [];
        grouped[prefix].push(slot);
    });

    for (const [rowName, rowSlots] of Object.entries(grouped)) {
        const rowHeader = document.createElement('h3');
        rowHeader.textContent = `Zone ${rowName}`;
        rowHeader.style.width = '100%';
        rowHeader.style.margin = '20px 0 10px 0';
        container.appendChild(rowHeader);

        const rowDiv = document.createElement('div');
        rowDiv.className = 'slots';

        rowSlots.forEach(slot => {
            let badgeClass = '';
            if (slot.status === 'available') badgeClass = 'badge-completed';
            else if (slot.status === 'reserved') badgeClass = 'badge-pending';
            else badgeClass = 'badge-cancelled';
            
            rowDiv.innerHTML += `
            <div class="slot ${slot.status}">
                <strong>${slot.slot_number}</strong>
                <small>${slot.vehicle_type}</small>
                <span class="badge ${badgeClass}" style="margin: 6px 0;">${slot.status}</span>
                <button class="btn btn-danger" style="padding: 4px 8px; font-size: 10px; margin-top: auto;" onclick="promptDeleteSlot('${slot.id}', '${slot.slot_number}', '${slot.status}')"><i data-lucide="trash-2" size="12"></i> Delete</button>
            </div>`;
        });
        container.appendChild(rowDiv);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function addSlot(e) {
    e.preventDefault();
    const btn = document.getElementById('saveSlotBtn');
    const slotNumber = document.getElementById('newSlotNumber').value.trim().toUpperCase();
    const vehicleType = document.getElementById('newSlotType').value;
    
    setLoading(btn, true, 'Saving...');

    try {
        const { error } = await supabase.from('parking_slots').insert([{ slot_number: slotNumber, vehicle_type: vehicleType }]);
        if (error) {
            if (error.code === '23505') throw new Error("A slot with this number already exists.");
            throw error;
        }
        
        document.getElementById('newSlotNumber').value = '';
        closeModal('addSlotModal');
        showToast(`Slot ${slotNumber} added successfully`, 'success');
        
        await loadStats();
        await loadAdminSlots();
    } catch (err) { 
        showToast(err.message || "Error adding slot.", 'error');
    } finally {
        setLoading(btn, false);
    }
}

function promptDeleteSlot(id, number, status) {
    if (status !== 'available') {
        showToast('Cannot delete an occupied or reserved parking slot.', 'warning');
        return;
    }
    slotToDelete = id;
    document.getElementById('deleteSlotNumber').textContent = number;
    openModal('deleteSlotModal');
    
    document.getElementById('confirmDeleteSlotBtn').onclick = async () => {
        const btn = document.getElementById('confirmDeleteSlotBtn');
        setLoading(btn, true, 'Deleting...');
        
        try {
            const { error } = await supabase.from('parking_slots').delete().eq('id', slotToDelete);
            if (error) throw error;
            showToast('Slot deleted', 'success');
            closeModal('deleteSlotModal');
            await loadStats();
            await loadAdminSlots();
        } catch(e) {
            showToast('Error deleting slot', 'error');
        } finally {
            setLoading(btn, false);
        }
    };
}

async function loadStudents() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*, vehicles(vehicle_number, vehicle_type)')
        .eq('role', 'student');
        
    const container = document.getElementById('studentsTable');
    if (!data || !data.length) return container.innerHTML = '<p class="muted">No students found.</p>';
    
    let html = `<table><tr><th>Name</th><th>Student ID</th><th>Vehicle</th><th>Type</th></tr>`;
    data.forEach(s => {
        let v_num = '--';
        let v_type = '--';
        if (s.vehicles && s.vehicles.length > 0) {
            v_num = s.vehicles[0].vehicle_number;
            v_type = s.vehicles[0].vehicle_type;
        }
        html += `<tr>
            <td><strong>${s.full_name}</strong></td>
            <td class="muted">${s.student_id}</td>
            <td>${v_num}</td>
            <td style="text-transform:uppercase;">${v_type}</td>
        </tr>`;
    });
    html += `</table>`;
    container.innerHTML = html;
}

async function loadActiveSessions() {
    const { data } = await supabase
        .from('access_logs')
        .select('*, profiles(name), vehicles(vehicle_number), parking_slots(slot_number)')
        .eq('status', 'active')
        .order('check_in_time', { ascending: false });
        
    const fullContainer = document.getElementById('activeTableFull');
    const dashContainer = document.getElementById('activeTableDash');
    
    if (!data || !data.length) {
        fullContainer.innerHTML = '<p class="muted">No active sessions.</p>';
        dashContainer.innerHTML = '<p class="muted" style="padding:16px;">No active sessions.</p>';
        return;
    }
    
    let html = `<table><tr><th>Student</th><th>Slot</th><th>Vehicle</th><th>Check In</th></tr>`;
    let dashHtml = `<table>`;
    
    data.forEach((s, i) => {
        const row = `<tr>
            <td><strong>${s.profiles.full_name}</strong></td>
            <td><span class="badge badge-active">${s.parking_slots.slot_number}</span></td>
            <td>${s.vehicles.vehicle_number}</td>
            <td class="muted">${new Date(s.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
        </tr>`;
        html += row;
        if (i < 5) dashHtml += row; // only show 5 in overview
    });
    html += `</table>`;
    dashHtml += `</table>`;
    
    fullContainer.innerHTML = html;
    dashContainer.innerHTML = dashHtml;
}

async function loadHistory() {
    const { data } = await supabase
        .from('access_logs')
        .select('*, profiles(name), vehicles(vehicle_number), parking_slots(slot_number)')
        .eq('status', 'completed')
        .order('created_at', {ascending: false})
        .limit(20);
        
    const fullContainer = document.getElementById('historyTableFull');
    const dashContainer = document.getElementById('historyTableDash');
    
    if (!data || !data.length) {
        fullContainer.innerHTML = '<p class="muted">No history.</p>';
        dashContainer.innerHTML = '<p class="muted" style="padding:16px;">No history.</p>';
        return;
    }
    
    let html = `<table><tr><th>Student</th><th>Slot</th><th>Vehicle</th><th>Status</th><th>Date</th></tr>`;
    let dashHtml = `<table>`;
    
    data.forEach((s, i) => {
        const dateStr = new Date(s.created_at).toLocaleDateString();
        const row = `<tr>
            <td><strong>${s.profiles?.full_name || 'N/A'}</strong></td>
            <td>${s.parking_slots?.slot_number || 'N/A'}</td>
            <td>${s.vehicles?.vehicle_number || 'N/A'}</td>
            <td><span class="badge badge-completed">${s.status}</span></td>
            <td class="muted">${dateStr}</td>
        </tr>`;
        html += row;
        if (i < 5) dashHtml += row;
    });
    
    html += `</table>`;
    dashHtml += `</table>`;
    
    fullContainer.innerHTML = html;
    dashContainer.innerHTML = dashHtml;
}
