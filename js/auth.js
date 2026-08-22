document.addEventListener('DOMContentLoaded', () => { 
    // Login Flow
    document.getElementById('login-phone-form')?.addEventListener('submit', loginPhoneUser); 
    document.getElementById('login-otp-form')?.addEventListener('submit', verifyLoginOtp);
    
    // Register Flow
    document.getElementById('register-phone-form')?.addEventListener('submit', registerPhoneUser); 
    document.getElementById('register-otp-form')?.addEventListener('submit', verifyRegisterOtp);
    
    setupOtpInputs('login-otp-form');
    setupOtpInputs('register-otp-form');
});

function showMessage(id, text, success = false) { 
    const e = document.getElementById(id); 
    if (e) { 
        e.textContent = text; 
        e.className = success ? 'success-msg visible' : 'error-msg visible'; 
    } 
}

async function getCurrentUser() { 
    const { data: { user } } = await supabase.auth.getUser(); 
    return user; 
}

async function getUserRole() { 
    const u = await getCurrentUser(); 
    if (!u) return null; 
    
    // Fetch profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', u.id).single(); 
    if (!profile) return null;

    // Fetch vehicle if student
    if (profile.role === 'student') {
        const { data: vehicle } = await supabase.from('vehicles').select('*').eq('user_id', u.id).order('created_at', {ascending: false}).limit(1).single();
        if (vehicle) {
            profile.vehicle_id = vehicle.id;
            profile.vehicle_number = vehicle.vehicle_number;
            profile.vehicle_type = vehicle.vehicle_type;
        }
    }
    
    return profile; 
}

function redirectBasedOnRole(role) { 
    location.href = role === 'admin' ? 'admin.html' : role === 'security' ? 'security.html' : role === 'student' ? 'student.html' : 'index.html'; 
}

// ----- PHONE AUTHENTICATION (LOGIN) -----
let loginPhoneStore = '';

async function loginPhoneUser(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const phone = document.getElementById('phone').value.trim();
    if (!phone) return showMessage('login-error', 'Please enter a valid phone number.');
    
    loginPhoneStore = phone;
    showMessage('login-error', '');
    if (btn) setLoading(btn, true, 'Sending OTP...');
    
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (btn) setLoading(btn, false);
    
    if (error) return showMessage('login-error', 'Unable to send OTP. Please check the phone number and try again.');
    
    document.getElementById('login-step-phone').style.display = 'none';
    document.getElementById('login-step-otp').style.display = 'block';
    document.getElementById('display-phone').textContent = phone;
    startResendCountdown('login');
}

async function verifyLoginOtp(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const inputs = document.querySelectorAll('#login-otp-form .otp-input');
    const otp = Array.from(inputs).map(i => i.value).join('');
    
    if (otp.length !== 6) return showMessage('otp-error', 'Please enter the 6-digit code.');
    
    showMessage('otp-error', '');
    if (btn) setLoading(btn, true, 'Verifying...');
    
    const { data, error } = await supabase.auth.verifyOtp({ phone: loginPhoneStore, token: otp, type: 'sms' });
    if (btn) setLoading(btn, false);
    
    if (error) return showMessage('otp-error', 'Incorrect OTP. Please try again.');
    
    const p = await getUserRole(); 
    if (!p) return showMessage('otp-error', 'Your profile is not ready. Are you sure you registered?'); 
    redirectBasedOnRole(p.role); 
}

// ----- PHONE AUTHENTICATION (REGISTER) -----
let registerPhoneStore = '';
let registerDetailsStore = {};

async function registerPhoneUser(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const n = document.getElementById('name').value.trim();
    const ph = document.getElementById('phone').value.trim();
    const type = document.getElementById('vehicle_type').value;
    const vehicle_number = document.getElementById('vehicle_number').value.trim().toUpperCase();
    
    if (!n || !ph || !vehicle_number) return showMessage('register-error', 'Please fill all required fields.');
    
    registerPhoneStore = ph;
    registerDetailsStore = { n, ph, type, vehicle_number };
    
    showMessage('register-error', '');
    if (btn) setLoading(btn, true, 'Sending OTP...');
    
    const { error } = await supabase.auth.signInWithOtp({ 
        phone: ph, 
        options: { data: { name: n } } 
    });
    if (btn) setLoading(btn, false);
    
    if (error) return showMessage('register-error', 'Unable to send OTP. Please check the phone number and try again.');
    
    document.getElementById('register-step-form').style.display = 'none';
    document.getElementById('register-step-otp').style.display = 'block';
    document.getElementById('register-display-phone').textContent = ph;
    startResendCountdown('register');
}

async function verifyRegisterOtp(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const inputs = document.querySelectorAll('#register-otp-form .otp-input');
    const otp = Array.from(inputs).map(i => i.value).join('');
    
    if (otp.length !== 6) return showMessage('register-otp-error', 'Please enter the 6-digit code.');
    
    showMessage('register-otp-error', '');
    if (btn) setLoading(btn, true, 'Verifying...');
    
    const { data, error } = await supabase.auth.verifyOtp({ phone: registerPhoneStore, token: otp, type: 'sms' });
    
    if (error) {
        if (btn) setLoading(btn, false);
        return showMessage('register-otp-error', 'Incorrect OTP. Please try again.');
    }
    
    await new Promise(r => setTimeout(r, 800)); // wait for trigger

    if (data.user) {
        const { error: pe } = await supabase.from('profiles').update({ full_name: registerDetailsStore.n, phone: registerPhoneStore }).eq('id', data.user.id); 
        const { error: ve } = await supabase.from('vehicles').insert([{
            user_id: data.user.id,
            vehicle_number: registerDetailsStore.vehicle_number,
            vehicle_type: registerDetailsStore.type
        }]);
    }

    if (btn) setLoading(btn, false);
    redirectBasedOnRole('student');
}

// ----- OTP UX UTILITIES -----
function setupOtpInputs(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    const inputs = form.querySelectorAll('.otp-input');
    
    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text').slice(0, inputs.length).replace(/[^0-9]/g, '');
            pastedData.split('').forEach((char, i) => {
                if (inputs[index + i]) {
                    inputs[index + i].value = char;
                    if (index + i < inputs.length - 1) inputs[index + i + 1].focus();
                }
            });
        });
    });
}

function changePhoneNumber(context) {
    if (context === 'login') {
        document.getElementById('login-step-otp').style.display = 'none';
        document.getElementById('login-step-phone').style.display = 'block';
        document.querySelectorAll('#login-otp-form .otp-input').forEach(i => i.value = '');
    } else {
        document.getElementById('register-step-otp').style.display = 'none';
        document.getElementById('register-step-form').style.display = 'block';
        document.querySelectorAll('#register-otp-form .otp-input').forEach(i => i.value = '');
    }
}

function startResendCountdown(context) {
    const btn = document.getElementById(context === 'login' ? 'resend-btn' : 'register-resend-btn');
    const txt = document.getElementById(context === 'login' ? 'resend-text' : 'register-resend-text');
    let timeLeft = 30;
    
    btn.disabled = true;
    btn.onclick = () => resendOtp(context);
    
    const timer = setInterval(() => {
        timeLeft--;
        txt.textContent = `Resend OTP in ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(timer);
            txt.textContent = "Didn't receive the code?";
            btn.disabled = false;
        }
    }, 1000);
}

async function resendOtp(context) {
    const phone = context === 'login' ? loginPhoneStore : registerPhoneStore;
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
        showMessage(context === 'login' ? 'otp-error' : 'register-otp-error', 'Unable to resend OTP. Try again later.');
    } else {
        startResendCountdown(context);
    }
}

async function logoutUser() { 
    await supabase.auth.signOut(); 
    location.href = 'index.html'; 
}

async function checkAuthAndRole(expected) { 
    const p = await getUserRole(); 
    if (!p) { 
        location.href = 'login.html'; 
        return null; 
    } 
    if (expected && p.role !== expected) { 
        redirectBasedOnRole(p.role); 
        return null; 
    } 
    return p; 
}

// Global UI Functions
function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'info';
    if (type === 'success') icon = 'check-circle-2';
    if (type === 'error') icon = 'x-circle';
    if (type === 'warning') icon = 'alert-triangle';
    
    toast.innerHTML = `<i data-lucide="${icon}" size="16"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Close modals on clicking outside or ESC
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeModal(e.target.id);
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            closeModal(modal.id);
        });
    }
});

function setLoading(button, isLoading, text = 'Processing...') {
    if (isLoading) {
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = `<i data-lucide="loader-2" class="spin" size="16"></i> ${text}`;
        button.disabled = true;
    } else {
        button.innerHTML = button.dataset.originalText || button.innerHTML;
        button.disabled = false;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Global Profile Dropdown logic
document.addEventListener('DOMContentLoaded', () => {
    const profileBtn = document.querySelector('.user-profile');
    if (profileBtn) {
        // Create dropdown if it doesn't exist
        if (!document.getElementById('profileDropdown')) {
            const dropdown = document.createElement('div');
            dropdown.id = 'profileDropdown';
            dropdown.className = 'dropdown-menu';
            dropdown.innerHTML = `
                <button class="dropdown-item" onclick="logoutUser()">
                    <i data-lucide="log-out" size="16"></i> Logout
                </button>
            `;
            profileBtn.style.position = 'relative';
            profileBtn.appendChild(dropdown);
        }
        
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('profileDropdown').classList.toggle('active');
        });
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu.active').forEach(d => d.classList.remove('active'));
    });
});
