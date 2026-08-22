// js/security.js
let currentReservation = null;
let scanner = null;
let isScanning = false;

document.addEventListener('DOMContentLoaded', async () => {
    const profile = await checkAuthAndRole('security');
    if (profile) {
        
        // Auto-scan if URL has ?token=
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("token");
        if (urlToken) {
            document.getElementById('manualToken').value = urlToken;
            verifyToken(urlToken);
        }
    }
});

function startCamera() {
    if (isScanning) return;
    
    document.getElementById('reader').style.display = 'block';
    document.getElementById('startCamBtn').classList.add('hidden');
    document.getElementById('stopCamBtn').classList.remove('hidden');
    
    scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
    scanner.render(onScanSuccess, (err) => {});
    isScanning = true;
}

function stopCamera() {
    if (!isScanning) return;
    
    if (scanner) {
        scanner.clear().catch(e => console.error(e));
        scanner = null;
    }
    
    document.getElementById('reader').style.display = 'none';
    document.getElementById('startCamBtn').classList.remove('hidden');
    document.getElementById('stopCamBtn').classList.add('hidden');
    isScanning = false;
}

function onScanSuccess(decodedText) {
    stopCamera();
    
    let token = decodedText;
    
    // If it's a URL, extract the token
    if (token.includes('?token=')) {
        try {
            const url = new URL(token);
            const extracted = url.searchParams.get('token');
            if (extracted) token = extracted;
        } catch (e) {}
    }
    
    document.getElementById('manualToken').value = token;
    verifyToken(token);
}

function verifyManualToken(e) {
    e.preventDefault();
    const token = document.getElementById('manualToken').value.trim();
    if (token) verifyToken(token);
}

async function verifyToken(token) {
    document.getElementById('sessionInfo').classList.add('hidden');
    
    const verifyBtn = document.getElementById('verifyBtn');
    setLoading(verifyBtn, true, 'Verifying...');

    try {
        const { data: reservation, error } = await supabase
            .from('parking_reservations')
            .select('*, profiles(name), vehicles(vehicle_number, vehicle_type), parking_slots(slot_number)')
            .eq('access_token', token)
            .single();

        if (error || !reservation) {
            showToast('Invalid QR Code: Not registered with CampusPark.', 'error');
            return;
        }

        if (new Date(reservation.expires_at) < new Date() && reservation.status === 'reserved') {
            showToast('QR EXPIRED: This parking reservation has expired.', 'warning');
            return;
        }

        if (reservation.status === 'completed') {
            showToast('This parking QR has already been used.', 'warning');
            return;
        }

        if (reservation.status === 'cancelled') {
            showToast('This parking pass has been cancelled.', 'error');
            return;
        }

        currentReservation = reservation;
        displayReservation(reservation);
    } catch (err) {
        showToast('Error verifying QR Code.', 'error');
    } finally {
        setLoading(verifyBtn, false);
    }
}

function displayReservation(reservation) {
    document.getElementById('sessionInfo').classList.remove('hidden');
    
    const detailsDiv = document.getElementById('sessionDetails');
    const actions = document.getElementById('actionButtons');

    if (reservation.status === 'reserved') {
        detailsDiv.innerHTML = `
            <div style="display: grid; gap: 12px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between;">
                    <span class="muted">Student:</span> 
                    <strong style="color: var(--text-primary);">${reservation.profiles.name}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span class="muted">Vehicle:</span> 
                    <strong style="color: var(--text-primary);">${reservation.vehicles.vehicle_number} (${reservation.vehicles.vehicle_type})</strong>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="muted">Parking Slot:</span> 
                    <strong style="color: var(--text-primary); font-size: 18px; padding: 4px 10px; background: rgba(185, 255, 241, 0.1); border-radius: var(--radius-sm); color: var(--accent-primary); border: 1px solid rgba(185, 255, 241, 0.2);">${reservation.parking_slots.slot_number}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span class="muted">Status:</span> 
                    <span class="badge badge-pending">Reserved</span>
                </div>
                <div style="margin-top: 16px; text-align: center; font-weight: 600; color: var(--accent-primary);">
                    MUST PARK IN SLOT ${reservation.parking_slots.slot_number}
                </div>
            </div>
        `;
        actions.innerHTML = `<button id="checkInBtn" class="btn" style="width:100%;" onclick="approveEntry('${reservation.id}')"><i data-lucide="check" size="16"></i> CONFIRM CHECK-IN</button>`;
    } else if (reservation.status === 'active') {
        detailsDiv.innerHTML = `
            <div style="display: grid; gap: 12px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between;">
                    <span class="muted">Student:</span> 
                    <strong style="color: var(--text-primary);">${reservation.profiles.name}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span class="muted">Vehicle:</span> 
                    <strong style="color: var(--text-primary);">${reservation.vehicles.vehicle_number}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span class="muted">Parking Slot:</span> 
                    <strong style="color: var(--text-primary);">${reservation.parking_slots.slot_number}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span class="muted">Status:</span> 
                    <span class="badge badge-active">Currently Parked</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span class="muted">Check-in:</span> 
                    <strong style="color: var(--text-primary);">${new Date(reservation.used_at).toLocaleTimeString()}</strong>
                </div>
            </div>
        `;
        actions.innerHTML = `<button id="checkOutBtn" class="btn btn-danger" style="width:100%;" onclick="markExit('${reservation.id}')"><i data-lucide="log-out" size="16"></i> CHECK OUT VEHICLE</button>`;
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function approveEntry(reservationId) {
    const btn = document.getElementById('checkInBtn');
    setLoading(btn, true, 'Checking in...');
    
    try {
        const { error } = await supabase.rpc('approve_parking_entry', { p_reservation_id: reservationId });
        if (error) throw error;
        
        showToast('Vehicle checked in successfully!', 'success');
        
        // Refresh display
        await verifyToken(currentReservation.access_token);
    } catch (error) {
        showToast(error.message || 'Error checking in vehicle.', 'error');
    } finally {
        if (btn) setLoading(btn, false);
    }
}

async function markExit(reservationId) {
    const btn = document.getElementById('checkOutBtn');
    setLoading(btn, true, 'Checking out...');
    
    try {
        const { error } = await supabase.rpc('complete_parking_exit', { p_reservation_id: reservationId });
        if (error) throw error;
        
        showToast('Vehicle checked out successfully!', 'success');
        
        document.getElementById('sessionInfo').classList.add('hidden');
        document.getElementById('manualToken').value = '';
        currentReservation = null;
    } catch (error) {
        showToast(error.message || 'Error checking out vehicle.', 'error');
    } finally {
        if (btn) setLoading(btn, false);
    }
}
