// js/admin.js
document.addEventListener('DOMContentLoaded', async () => {
    const profile = await checkAuthAndRole('admin');
    if (profile) {
        loadStats();
        loadAdminSlots();
        loadStudents();
        loadActiveSessions();
        loadHistory();
    }
});

async function loadStats() {
    try {
        const { data: slots, error: slotsError } = await supabase.from('parking_slots').select('status');
        if (slotsError) throw slotsError;
        document.getElementById('statTotal').textContent = slots.length;
        document.getElementById('statAvailable').textContent = slots.filter(s => s.status === 'available').length;
        document.getElementById('statOccupied').textContent = slots.filter(s => s.status === 'occupied').length;

        const { data: sessions, error: sessionsError } = await supabase.from('parking_sessions').select('id').eq('status', 'active');
        if (sessionsError) throw sessionsError;
        document.getElementById('statActiveSessions').textContent = sessions.length;
    } catch (err) { console.error(err); }
}

async function loadAdminSlots() {
    try {
        const { data: slots, error } = await supabase.from('parking_slots').select('*').order('slot_number');
        if (error) throw error;
        const container = document.getElementById('adminSlotsContainer');
        container.innerHTML = '';
        slots.forEach(slot => {
            container.innerHTML += `
            <div class="slot ${slot.status}">
                <strong>${slot.slot_number}</strong>
                <small>${slot.vehicle_type}</small>
                <button class="link-danger" onclick="deleteSlot('${slot.id}')">Delete</button>
            </div>`;
        });
    } catch (err) { console.error(err); }
}

async function addSlot() {
    const slotNumber = document.getElementById('newSlotNumber').value.trim().toUpperCase();
    const vehicleType = document.getElementById('newSlotType').value;
    const msg = document.getElementById('admin-message');
    msg.className = 'error-msg';
    
    if (!slotNumber) { msg.textContent = "Please enter a slot number."; msg.classList.add('visible'); return; }

    try {
        const { error } = await supabase.from('parking_slots').insert([{ slot_number: slotNumber, vehicle_type: vehicleType }]);
        if (error) throw error;
        document.getElementById('newSlotNumber').value = '';
        msg.classList.remove('visible');
        loadStats();
        loadAdminSlots();
    } catch (err) { msg.textContent = "Error adding slot (maybe duplicate?)."; msg.classList.add('visible'); }
}

async function deleteSlot(id) {
    if(!confirm("Are you sure?")) return;
    await supabase.from('parking_slots').delete().eq('id', id);
    loadStats();
    loadAdminSlots();
}

async function loadStudents() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'student');
    const container = document.getElementById('studentsTable');
    if (!data || !data.length) return container.innerHTML = '<p class="muted">No students found.</p>';
    
    let html = `<div class="table-wrap"><table><tr><th>Name</th><th>Vehicle</th><th>Type</th></tr>`;
    data.forEach(s => html += `<tr><td>${s.name}</td><td>${s.vehicle_number}</td><td>${s.vehicle_type}</td></tr>`);
    html += `</table></div>`;
    container.innerHTML = html;
}

async function loadActiveSessions() {
    const { data } = await supabase.from('parking_sessions').select('*, profiles(name), parking_slots(slot_number)').eq('status', 'active');
    const container = document.getElementById('activeTable');
    if (!data || !data.length) return container.innerHTML = '<p class="muted">No active sessions.</p>';
    
    let html = `<div class="table-wrap"><table><tr><th>Student</th><th>Slot</th><th>Vehicle</th><th>Entry Time</th></tr>`;
    data.forEach(s => html += `<tr><td>${s.profiles.name}</td><td>${s.parking_slots.slot_number}</td><td>${s.vehicle_number}</td><td>${new Date(s.entry_time).toLocaleTimeString()}</td></tr>`);
    html += `</table></div>`;
    container.innerHTML = html;
}

async function loadHistory() {
    const { data } = await supabase.from('parking_sessions').select('*, profiles(name), parking_slots(slot_number)').in('status', ['completed', 'cancelled']).order('created_at', {ascending: false}).limit(10);
    const container = document.getElementById('historyTable');
    if (!data || !data.length) return container.innerHTML = '<p class="muted">No history.</p>';
    
    let html = `<div class="table-wrap"><table><tr><th>Student</th><th>Slot</th><th>Status</th><th>Date</th></tr>`;
    data.forEach(s => html += `<tr><td>${s.profiles?.name || 'N/A'}</td><td>${s.parking_slots?.slot_number || 'N/A'}</td><td><span class="badge badge-${s.status}">${s.status}</span></td><td>${new Date(s.created_at).toLocaleDateString()}</td></tr>`);
    html += `</table></div>`;
    container.innerHTML = html;
}
