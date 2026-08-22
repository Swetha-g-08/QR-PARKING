// js/student.js
let currentUserProfile = null;
let selectedSlotId = null;
let selectedSlotNumber = null;
let currentReservation = null;
let activeTab = 'tab-dashboard';

document.addEventListener('DOMContentLoaded', async () => {
    currentUserProfile = await checkAuthAndRole('student');
    if (currentUserProfile) {
        document.getElementById('welcomeMessage').textContent = `Welcome, ${currentUserProfile.name}`;
        
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
    await updateVehicleTab();
    await checkCurrentSession();
    await loadParkingSlots();
    await loadHistory();
    updateDashboardStats();

    // Populate Settings form
    document.getElementById('set_name').value = currentUserProfile.name || '';
    document.getElementById('set_student_id').value = currentUserProfile.student_id || '';
    document.getElementById('set_vehicle_number').value = currentUserProfile.vehicle_number || '';
    if (currentUserProfile.vehicle_type) {
        document.getElementById('set_vehicle_type').value = currentUserProfile.vehicle_type;
    }
}

// -----------------------------------------------------
// VEHICLE MANAGEMENT
// -----------------------------------------------------
async function updateVehicleTab() {
    const vCard = document.getElementById('vehicleDetails');
    const vNone = document.getElementById('noVehicleState');
    const vEdit = document.getElementById('editVehicleBtn');
    
    if (currentUserProfile.vehicle_number) {
        vCard.classList.remove('hidden');
        vNone.classList.add('hidden');
        vEdit.classList.remove('hidden');
        
        document.getElementById('vehNumberDisplay').textContent = currentUserProfile.vehicle_number;
        document.getElementById('vehTypeDisplay').textContent = currentUserProfile.vehicle_type;
        
        document.getElementById('dashVehicle').textContent = currentUserProfile.vehicle_number;
        document.getElementById('dashVehicleType').textContent = currentUserProfile.vehicle_type.toUpperCase();
    } else {
        vCard.classList.add('hidden');
        vNone.classList.remove('hidden');
        vEdit.classList.add('hidden');
        
        document.getElementById('dashVehicle').textContent = 'No Vehicle';
        document.getElementById('dashVehicleType').textContent = '--';
    }
}

async function saveVehicle(e) {
    e.preventDefault();
    const btn = document.getElementById('saveVehicleBtn');
    const msg = document.getElementById('modal-vehicle-error');
    msg.classList.remove('visible');
    
    const vNum = document.getElementById('vehNumberInput').value.trim().toUpperCase();
    const vType = document.getElementById('vehTypeInput').value;
    
    setLoading(btn, true, 'Saving...');
    
    try {
        const res = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentId: currentUserProfile.student_id,
                name: currentUserProfile.name,
                vehicle_number: vNum,
                vehicle_type: vType
            })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to update vehicle');
        }

        showToast('Vehicle updated successfully', 'success');
        
        currentUserProfile.vehicle_number = vNum;
        currentUserProfile.vehicle_type = vType;
        
        closeModal('vehicleModal');
        await refreshAllData();
    } catch (err) {
        msg.textContent = err.message || 'Error saving vehicle';
        msg.classList.add('visible');
    } finally {
        setLoading(btn, false);
    }
}

async function deleteVehicle() {
    const btn = document.getElementById('confirmDeleteVehBtn');
    const msg = document.getElementById('modal-delete-error');
    msg.classList.remove('visible');
    
    if (!currentUserProfile.vehicle_number) return;
    
    setLoading(btn, true, 'Deleting...');
    
    try {
        // Must ensure no active reservations
        const { data: res } = await supabase.from('parking_reservations').select('id').eq('user_id', currentUserProfile.id).in('status', ['reserved', 'active']);
        if (res && res.length > 0) throw new Error("Cannot delete vehicle with an active parking reservation.");

        const updateRes = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentId: currentUserProfile.student_id,
                name: currentUserProfile.name,
                vehicle_number: '',
                vehicle_type: ''
            })
        });

        if (!updateRes.ok) {
            const data = await updateRes.json();
            throw new Error(data.error || 'Failed to delete vehicle');
        }
        
        currentUserProfile.vehicle_number = '';
        currentUserProfile.vehicle_type = '';
        
        showToast('Vehicle deleted', 'success');
        closeModal('deleteVehicleModal');
        await refreshAllData();
    } catch (err) {
        msg.textContent = err.message || 'Error deleting vehicle';
        msg.classList.add('visible');
    } finally {
        setLoading(btn, false);
    }
}

// -----------------------------------------------------
// SETTINGS MANAGEMENT
// -----------------------------------------------------
async function saveSettings(e) {
    e.preventDefault();
    const btn = document.getElementById('saveSettingsBtn');
    const msg = document.getElementById('settings-error');
    msg.classList.remove('visible');
    
    const sName = document.getElementById('set_name').value.trim();
    const sVNum = document.getElementById('set_vehicle_number').value.trim().toUpperCase();
    const sVType = document.getElementById('set_vehicle_type').value;
    
    setLoading(btn, true, 'Saving...');
    
    try {
        const updateRes = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentId: currentUserProfile.student_id,
                name: sName,
                vehicle_number: sVNum,
                vehicle_type: sVType
            })
        });

        if (!updateRes.ok) {
            const data = await updateRes.json();
            throw new Error(data.error || 'Failed to update settings');
        }

        const data = await updateRes.json();
        currentUserProfile.name = data.name;
        currentUserProfile.vehicle_number = data.vehicle_number;
        currentUserProfile.vehicle_type = data.vehicle_type;
        
        document.getElementById('welcomeMessage').textContent = `Welcome, ${currentUserProfile.name}`;
        
        showToast('Settings saved successfully', 'success');
        await refreshAllData();
    } catch (err) {
        msg.textContent = err.message || 'Error saving settings';
        msg.classList.add('visible');
    } finally {
        setLoading(btn, false);
    }
}


// -----------------------------------------------------
// RESERVATIONS & QR
// -----------------------------------------------------
async function checkCurrentSession() {
    const { data: reservations } = await supabase
        .from('parking_reservations')
        .select('*, parking_slots(slot_number)')
        .eq('user_id', currentUserProfile.id)
        .in('status', ['reserved', 'active'])
        .order('created_at', { ascending: false })
        .limit(1);

    const navQr = document.getElementById('navQr');
    
    if (reservations && reservations.length > 0) {
        currentReservation = reservations[0];
        navQr.classList.remove('hidden');
        displayCurrentSession(currentReservation);
    } else {
        currentReservation = null;
        navQr.classList.add('hidden');
        if (activeTab === 'tab-qr') switchTab('tab-dashboard');
        
        document.getElementById('dashStatus').textContent = 'No Pass';
        document.getElementById('dashSlot').textContent = '--';
        document.getElementById('dashStatus').style.color = 'var(--text-muted)';
    }
}

function displayCurrentSession(reservation) {
    const qrContainer = document.getElementById('qrCode');
    qrContainer.innerHTML = '';
    
    const qrUrl = window.location.origin + "/security.html?token=" + reservation.access_token;
    
    new QRCode(qrContainer, { 
        text: qrUrl, 
        width: 200, 
        height: 200, 
        correctLevel: QRCode.CorrectLevel.H, 
        colorDark: "#151918" 
    });
    
    qrContainer.style.display = 'flex';
    qrContainer.style.justifyContent = 'center';

    let statusDisplay = reservation.status === 'reserved' ? 'RESERVED' : 'PARKED';
    let statusColor = reservation.status === 'reserved' ? 'var(--warning)' : 'var(--accent-primary)';

    document.getElementById('sessionDetails').innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:12px;">
            <span class="muted">Status</span>
            <strong style="color:${statusColor};">${statusDisplay}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span class="muted">Slot</span>
            <strong style="color:var(--text-primary); font-size:16px;">${reservation.parking_slots.slot_number}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span class="muted">Vehicle</span>
            <strong>${currentUserProfile.vehicle_number}</strong>
        </div>
    `;
    
    // Update Dashboard Stats Card
    document.getElementById('dashStatus').textContent = statusDisplay;
    document.getElementById('dashStatus').style.color = statusColor;
    document.getElementById('dashSlot').textContent = 'Slot ' + reservation.parking_slots.slot_number;
}

function downloadQR() {
    if (!currentReservation) return;
    const img = document.querySelector('#qrCode img');
    if(!img) return;
    const a = document.createElement('a');
    a.href = img.src;
    a.download = `CampusPark-${currentReservation.parking_slots.slot_number}-${currentUserProfile.vehicle_number}.png`;
    a.click();
    showToast('QR Code downloaded', 'success');
}

function copyQrLink() {
    if (!currentReservation) return;
    const qrUrl = window.location.origin + "/security.html?token=" + currentReservation.access_token;
    navigator.clipboard.writeText(qrUrl).then(() => {
        showToast('QR Link copied to clipboard', 'success');
    });
}

// -----------------------------------------------------
// PARKING SLOTS
// -----------------------------------------------------
async function loadParkingSlots() {
    if (!currentUserProfile.vehicle_type) {
        document.getElementById('slotsContainer').innerHTML = '<p class="muted">Please register a vehicle to view available parking slots.</p>';
        return;
    }

    const { data: slots } = await supabase
        .from('parking_slots')
        .select('*')
        .eq('vehicle_type', currentUserProfile.vehicle_type)
        .order('slot_number');
        
    const container = document.getElementById('slotsContainer');
    container.innerHTML = '';

    if (!slots || !slots.length) {
        container.innerHTML = '<p class="muted">No slots available.</p>';
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
            const btn = document.createElement('button');
            btn.className = `slot ${slot.status}`;
            btn.innerHTML = `<strong>${slot.slot_number}</strong><small>${slot.status}</small>`;
            
            if (slot.status === 'available') {
                btn.onclick = () => {
                    if (currentReservation) {
                        showToast('You already have an active reservation.', 'warning');
                        return;
                    }
                    selectedSlotId = slot.id;
                    selectedSlotNumber = slot.slot_number;
                    
                    document.getElementById('confirmSlotLabel').textContent = slot.slot_number;
                    document.getElementById('confirmVehicleLabel').textContent = currentUserProfile.vehicle_number;
                    openModal('reserveModal');
                };
            } else {
                btn.disabled = true;
            }
            rowDiv.appendChild(btn);
        });
        
        container.appendChild(rowDiv);
    }
}

async function createParkingSession() {
    if (!selectedSlotId || !currentUserProfile.vehicle_id) return;
    
    const msg = document.getElementById('modal-reserve-error');
    msg.classList.remove('visible');
    
    const btn = document.getElementById('confirmReserveBtn');
    setLoading(btn, true, 'Reserving...');

    const token = crypto.randomUUID();

    const { error } = await supabase.rpc('reserve_parking_slot', {
        p_vehicle_id: currentUserProfile.vehicle_id,
        p_parking_slot_id: selectedSlotId,
        p_access_token: token
    });

    setLoading(btn, false);

    if (error) {
        msg.textContent = error.message || 'Error booking slot. It might have been taken.';
        msg.classList.add('visible');
        await loadParkingSlots();
    } else {
        closeModal('reserveModal');
        showToast(`Slot ${selectedSlotNumber} reserved!`, 'success');
        await refreshAllData();
        switchTab('tab-qr'); // Send them directly to their QR
    }
}

// -----------------------------------------------------
// HISTORY & DASHBOARD STATS
// -----------------------------------------------------
async function loadHistory() {
    const { data: reservations } = await supabase
        .from('parking_reservations')
        .select('*, parking_slots(slot_number), access_logs(check_in_time, check_out_time)')
        .eq('user_id', currentUserProfile.id)
        .in('status', ['completed', 'cancelled', 'expired'])
        .order('created_at', { ascending: false })
        .limit(10);
        
    const fullContainer = document.getElementById('historyTableContainer');
    const dashContainer = document.getElementById('recentTimeline');
    
    if (!reservations || !reservations.length) {
        fullContainer.innerHTML = '<p class="muted">Your completed parking sessions will appear here.</p>';
        dashContainer.innerHTML = '<p class="muted">No recent activity.</p>';
        return;
    }

    let fullHtml = '<table><tr><th>Date</th><th>Slot</th><th>In</th><th>Out</th><th>Status</th></tr>';
    let dashHtml = '';

    reservations.forEach((r, index) => {
        let entryTime = '--';
        let exitTime = '--';
        
        if (r.access_logs && r.access_logs.length > 0) {
            const log = r.access_logs[0];
            entryTime = log.check_in_time ? new Date(log.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--';
            exitTime = log.check_out_time ? new Date(log.check_out_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--';
        }

        const dateStr = new Date(r.created_at).toLocaleDateString();

        // Full History Table
        fullHtml += `<tr>
            <td class="muted">${dateStr}</td>
            <td><strong>${r.parking_slots.slot_number}</strong></td>
            <td>${entryTime}</td>
            <td>${exitTime}</td>
            <td><span class="badge badge-${r.status}">${r.status}</span></td>
        </tr>`;

        // Dashboard Timeline (Only top 3)
        if (index < 3) {
            dashHtml += `
            <div class="timeline-item">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <strong style="color:var(--text-primary); font-size:13px;">Parked in ${r.parking_slots.slot_number}</strong>
                    <span class="muted" style="font-size:11px;">${dateStr}</span>
                </div>
                <div style="font-size:12px; color:var(--text-muted);">In: ${entryTime} | Out: ${exitTime}</div>
            </div>`;
        }
    });
    
    fullHtml += '</table>';
    fullContainer.innerHTML = fullHtml;
    dashContainer.innerHTML = dashHtml;
}

function updateDashboardStats() {
    // Basic stats updating handled within other functions (checkCurrentSession, updateVehicleTab).
    // If we want total visits, we could calculate it from history.
}
