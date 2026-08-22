document.addEventListener('DOMContentLoaded', () => { 
    document.getElementById('login-form')?.addEventListener('submit', loginUser); 
    document.getElementById('register-form')?.addEventListener('submit', registerUser); 
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

async function loginUser(e) { 
    e.preventDefault(); 
    const mail = document.getElementById('email').value.trim(), pass = document.getElementById('password').value; 
    const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password: pass }); 
    if (error || !data.user) return showMessage('login-error', 'Invalid email or password.'); 
    const p = await getUserRole(); 
    if (!p) return showMessage('login-error', 'Your profile is not ready. Please contact an administrator.'); 
    redirectBasedOnRole(p.role); 
}

async function registerUser(e) { 
    e.preventDefault(); 
    
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    
    const n = document.getElementById('name').value.trim();
    const mail = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value;
    const confirmPass = document.getElementById('confirm_password').value;
    const ph = document.getElementById('phone').value.trim();
    const type = document.getElementById('vehicle_type').value;
    const vehicle_number = document.getElementById('vehicle_number').value.trim().toUpperCase();
          
    if (!n) return showMessage('register-error', 'Please enter your full name.');
    if (!mail || !mail.includes('@')) return showMessage('register-error', 'Please enter a valid email.');
    if (pass.length < 6) return showMessage('register-error', 'Password must contain at least 6 characters.');
    if (pass !== confirmPass) return showMessage('register-error', 'Passwords do not match.');
    if (!vehicle_number) return showMessage('register-error', 'Please enter your vehicle number.'); 
    
    showMessage('register-error', '');
    if (btn) setLoading(btn, true, 'Creating account...');
    
    try {
        const details = { name: n, phone: ph }; 
        const { data, error } = await supabase.auth.signUp({ email: mail, password: pass, options: { data: details } }); 
        
        if (error) {
            if (error.message.toLowerCase().includes('already registered')) {
                throw new Error("This email is already registered. Please log in instead.");
            }
            throw error;
        }
        
        // Wait for auth trigger to insert profile
        await new Promise(r => setTimeout(r, 800));

        if (data.user) {
            const { error: pe } = await supabase.from('profiles').update({ name: n, phone: ph, email: mail }).eq('id', data.user.id); 
            if (pe) console.error("Profile update error", pe);
            
            const { error: ve } = await supabase.from('vehicles').insert([{
                user_id: data.user.id,
                vehicle_number: vehicle_number,
                vehicle_type: type
            }]);
            if (ve) console.error("Vehicle insert error", ve);
        }

        if (!data.session) {
            showMessage('register-error', 'Account created successfully. Please check your email to confirm your account.', true);
        } else {
            showMessage('register-error', 'Account created successfully! Redirecting...', true);
            setTimeout(() => redirectBasedOnRole('student'), 1500);
        }
    } catch (err) {
        showMessage('register-error', err.message || 'Could not create the account. Check the email and password.');
    } finally {
        if (btn) setLoading(btn, false);
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
