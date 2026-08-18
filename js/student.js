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
    
    document.getElementById('sessionDetails').innerHTML = `
        <p style="margin-bottom:8px;">Slot: <strong>${session.parking_slots.slot_number}</strong></p>
        <p>Status: <span class="badge badge-${session.status}">${session.status}</span></p>
    `;

    const qrContainer = document.getElementById('qrCode');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, { text: session.qr_token, width: 180, height: 180, colorDark: "#12355b" });
    
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

    slots.forEach(slot => {
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
        container.appendChild(btn);
    });
}

async function createParkingSession() {
    if (!selectedSlotId) return;
    const msg = document.getElementById('booking-error');
    msg.className = 'error-msg';
    
    const qrToken = 'PARK-' + crypto.randomUUID().split('-')[0].toUpperCase();
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
