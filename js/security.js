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
        msg.textContent = 'Invalid or unknown QR code.';
        msg.classList.add('visible');
        return;
    }

    msg.classList.remove('visible');
    currentSession = session;
    displaySession(session);
}

function displaySession(session) {
    document.getElementById('sessionInfo').classList.remove('hidden');
    
    document.getElementById('sessionDetails').innerHTML = `
        <p style="margin-bottom:8px;">Student: <strong>${session.profiles.name}</strong></p>
        <p style="margin-bottom:8px;">Vehicle: <strong>${session.vehicle_number}</strong></p>
        <p style="margin-bottom:8px;">Slot: <strong>${session.parking_slots.slot_number}</strong></p>
        <p style="margin-bottom:8px;">Status: <span class="badge badge-${session.status}">${session.status}</span></p>
        ${session.entry_time ? `<p style="margin-bottom:8px;">Entry: ${new Date(session.entry_time).toLocaleTimeString()}</p>` : ''}
        ${session.exit_time ? `<p style="margin-bottom:8px;">Exit: ${new Date(session.exit_time).toLocaleTimeString()}</p>` : ''}
    `;

    const actions = document.getElementById('actionButtons');
    if (session.status === 'pending') {
        actions.innerHTML = `<button class="btn" style="background:#087443; width:100%; margin-top:10px;" onclick="approveEntry('${session.id}', '${session.slot_id}')">Approve Entry</button>`;
    } else if (session.status === 'active') {
        actions.innerHTML = `<button class="btn btn-danger" style="width:100%; margin-top:10px;" onclick="markExit('${session.id}', '${session.slot_id}')">Mark Exit</button>`;
    } else {
        actions.innerHTML = `<p class="muted mt-1 text-center">Session is ${session.status}.</p>`;
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
