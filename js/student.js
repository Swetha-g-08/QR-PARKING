// js/student.js
let currentUserProfile = null;
let selectedSlotId = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentUserProfile = await checkAuthAndRole('student');
    if (currentUserProfile) {
        document.getElementById('welcomeMessage').textContent = `Welcome, ${currentUserProfile.name}`;
        document.getElementById('vehicleDetails').innerHTML = `<p class="muted" style="margin:0;">Vehicle: <strong>${currentUserProfile.vehicle_number}</strong> (${currentUserProfile.vehicle_type.toUpperCase()})</p>`;

        
        checkCurrentSession();
        loadHistory();
    }
});

async function checkCurrentSession() {
    const { data: sessions } = await supabase.from('parking_sessions').select('*, parking_slots(slot_number)').eq('user_id', currentUserProfile.id).in('status', ['pending', 'active']).order('created_at', { ascending: false }).limit(1);

    if (sessions && sessions.length > 0) {
        displayCurrentSession(sessions[0]);
    } else {
        document.getElementById('bookSlotSection').classList.remove('hidden');
        loadParkingSlots();
    }
}

function displayCurrentSession(session) {
    document.getElementById('bookSlotSection').classList.add('hidden');
    document.getElementById('currentSessionSection').classList.remove('hidden');
    
    const qrContainer = document.getElementById('qrCode');
    qrContainer.innerHTML = '';
    
    // Ensure QR code encodes exactly the token and is large enough
    new QRCode(qrContainer, { text: session.qr_token, width: 240, height: 240, correctLevel: QRCode.CorrectLevel.H, colorDark: "#12355b" });
    qrContainer.style.display = 'flex';
    qrContainer.style.justifyContent = 'center';
    qrContainer.style.padding = '15px';

    document.getElementById('sessionDetails').innerHTML = `
        <p style="font-size: 1.25rem; font-weight: bold; text-align: center; margin-bottom: 25px; letter-spacing: 1px; word-break: break-all;">${session.qr_token}</p>
        <h3 style="margin-bottom:12px; font-size:1.05rem;">Your parking details</h3>
        <p style="margin-bottom:8px;">Name: <strong>${currentUserProfile.name}</strong></p>
        <p style="margin-bottom:8px;">Vehicle: <strong>${currentUserProfile.vehicle_number}</strong></p>
        <p style="margin-bottom:8px;">Type: <strong>${currentUserProfile.vehicle_type.charAt(0).toUpperCase() + currentUserProfile.vehicle_type.slice(1)}</strong></p>
        <p style="margin-bottom:8px;">Status: <strong>${session.status === 'pending' ? 'Ready to scan' : session.status}</strong></p>
        <p style="margin-top:25px; text-align:center; color:var(--muted); font-size:0.9rem;">At the entrance, a warden scans this code to verify your parking.</p>
    `;
    
    document.getElementById('downloadQrBtn').classList.remove('hidden');
    document.getElementById('downloadQrBtn').onclick = () => {
        const img = qrContainer.querySelector('img');
        if(!img) return;
        const a = document.createElement('a');
        a.href = img.src;
        a.download = `QR_${session.qr_token}.png`;
        a.click();
    };
}

async function loadParkingSlots() {
    const { data: slots } = await supabase.from('parking_slots').select('*').eq('vehicle_type', currentUserProfile.vehicle_type).order('slot_number');
    const container = document.getElementById('slotsContainer');
    container.innerHTML = '';

    if (!slots || !slots.length) {
        container.innerHTML = '<p class="muted">No slots available for your vehicle type.</p>';
        return;
    }

    // Group by first letter (e.g. 'A', 'B') to create rows
    const grouped = {};
    slots.forEach(slot => {
        const match = slot.slot_number.match(/^[a-zA-Z]+/);
        const prefix = match ? match[0].toUpperCase() : 'Other';
        if (!grouped[prefix]) grouped[prefix] = [];
        grouped[prefix].push(slot);
    });

    for (const [rowName, rowSlots] of Object.entries(grouped)) {
        // Add row header
        const rowHeader = document.createElement('h3');
        rowHeader.textContent = `Row ${rowName}`;
        rowHeader.style.width = '100%';
        rowHeader.style.margin = '15px 0 5px 0';
        rowHeader.style.fontSize = '1.1rem';
        container.appendChild(rowHeader);

        // Add grid for this row
        const rowDiv = document.createElement('div');
        rowDiv.className = 'slots';
        rowDiv.style.margin = '0';

        rowSlots.forEach(slot => {
            const btn = document.createElement('button');
            btn.className = `slot ${slot.status}`;
            btn.innerHTML = `<strong>${slot.slot_number}</strong><small>${slot.status}</small>`;
            
            if (slot.status === 'available') {
                btn.onclick = () => {
                    document.querySelectorAll('.slot').forEach(el => el.classList.remove('selected'));
                    btn.classList.add('selected');
                    selectedSlotId = slot.id;
                    document.getElementById('bookBtn').classList.remove('hidden');
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
    if (!selectedSlotId) return;
    const msg = document.getElementById('booking-error');
    msg.className = 'error-msg';
    
    // Check for existing active/pending session
    const { data: existing } = await supabase.from('parking_sessions').select('id').eq('user_id', currentUserProfile.id).in('status', ['pending', 'active']);
    if (existing && existing.length > 0) {
        msg.textContent = 'You already have an active parking pass.';
        msg.classList.add('visible');
        return;
    }
    
    const qrToken = 'PARK-' + crypto.randomUUID().toUpperCase();
    const { error } = await supabase.from('parking_sessions').insert([{
        user_id: currentUserProfile.id,
        slot_id: selectedSlotId,
        vehicle_number: currentUserProfile.vehicle_number,
        qr_token: qrToken,
        status: 'pending'
    }]);

    if (error) {
        msg.textContent = 'Error booking slot. It might have been taken.';
        msg.classList.add('visible');
    } else {
        window.location.reload();
    }
}

async function loadHistory() {
    const { data: sessions } = await supabase.from('parking_sessions').select('*, parking_slots(slot_number)').eq('user_id', currentUserProfile.id).in('status', ['completed', 'cancelled']).order('created_at', { ascending: false });
    const container = document.getElementById('historyContainer');
    if (!sessions || !sessions.length) {
        container.innerHTML = '<p class="muted">No previous parking history.</p>';
        return;
    }

    let html = '';
    sessions.forEach(s => {
        html += `<div style="padding:12px 0; border-bottom: 1px solid var(--line);">
            <strong>${s.parking_slots.slot_number}</strong> &nbsp; <span class="badge badge-${s.status}">${s.status}</span>
            <div style="font-size:0.85rem; color:var(--muted); margin-top:4px;">
                Entry: ${s.entry_time ? new Date(s.entry_time).toLocaleString() : 'N/A'} <br>
                Exit: ${s.exit_time ? new Date(s.exit_time).toLocaleString() : 'N/A'}
            </div>
        </div>`;
    });
    container.innerHTML = html;
}
