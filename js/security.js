// js/security.js
let currentSession = null;
let scanner = null;

document.addEventListener('DOMContentLoaded', async () => {
    const profile = await checkAuthAndRole('security');
    if (profile) {
        scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
        scanner.render(verifyToken, (err) => {});
    }
});

function verifyManualToken() {
    const token = document.getElementById('manualToken').value.trim();
    if (token) verifyToken(token);
}

async function verifyToken(token) {
    document.getElementById('sessionInfo').classList.add('hidden');
    const msg = document.getElementById('security-message');
    msg.className = 'error-msg';
    
    const { data: session, error } = await supabase.from('parking_sessions').select('*, profiles(name), parking_slots(slot_number)').eq('qr_token', token).single();

    if (error || !session) {
        msg.textContent = 'Invalid QR code';
        msg.classList.add('visible');
        return;
    }

    if (session.status === 'completed') {
        msg.textContent = 'QR code has already been used';
        msg.classList.add('visible');
        return;
    }

    if (session.status === 'cancelled') {
        msg.textContent = 'Parking pass has been cancelled';
        msg.classList.add('visible');
        return;
    }

    msg.classList.remove('visible');
    currentSession = session;
    displaySession(session);
}

function displaySession(session) {
    document.getElementById('sessionInfo').classList.remove('hidden');
    
    const detailsDiv = document.getElementById('sessionDetails');
    const actions = document.getElementById('actionButtons');

    if (session.status === 'pending') {
        detailsDiv.innerHTML = `
            <p style="margin-bottom:8px;">Student name: <strong>${session.profiles.name}</strong></p>
            <p style="margin-bottom:8px;">Vehicle number: <strong>${session.vehicle_number}</strong></p>
            <p style="margin-bottom:8px;">Parking slot: <strong>${session.parking_slots.slot_number}</strong></p>
            <p style="margin-bottom:8px;">Status: <strong>Pending</strong></p>
        `;
        actions.innerHTML = `<button class="btn" style="background:#087443; width:100%; margin-top:10px;" onclick="approveEntry('${session.id}', '${session.slot_id}')">Approve Entry</button>`;
    } else if (session.status === 'active') {
        detailsDiv.innerHTML = `
            <p style="margin-bottom:8px;">Student name: <strong>${session.profiles.name}</strong></p>
            <p style="margin-bottom:8px;">Vehicle number: <strong>${session.vehicle_number}</strong></p>
            <p style="margin-bottom:8px;">Parking slot: <strong>${session.parking_slots.slot_number}</strong></p>
            <p style="margin-bottom:8px;">Status: <strong>Active</strong></p>
            <p style="margin-bottom:8px;">Entry time: <strong>${new Date(session.entry_time).toLocaleTimeString()}</strong></p>
        `;
        actions.innerHTML = `<button class="btn btn-danger" style="width:100%; margin-top:10px;" onclick="markExit('${session.id}', '${session.slot_id}')">Mark Exit</button>`;
    }
}

async function approveEntry(sessionId, slotId) {
    await supabase.from('parking_sessions').update({ status: 'active', entry_time: new Date().toISOString() }).eq('id', sessionId);
    await supabase.from('parking_slots').update({ status: 'occupied' }).eq('id', slotId);
    verifyToken(currentSession.qr_token);
}

async function markExit(sessionId, slotId) {
    if(!confirm("Mark exit?")) return;
    await supabase.from('parking_sessions').update({ status: 'completed', exit_time: new Date().toISOString() }).eq('id', sessionId);
    await supabase.from('parking_slots').update({ status: 'available' }).eq('id', slotId);
    verifyToken(currentSession.qr_token);
}
