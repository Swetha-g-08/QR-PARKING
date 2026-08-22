document.addEventListener('DOMContentLoaded', () => { 
    // Login Flow
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', loginUser);
        
        // Check for registration success parameter
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('registered') === 'true') {
            showMessage('login-error', 'Account created successfully. Please login.', true);
            // Remove the query param so it doesn't show again on refresh
            window.history.replaceState({}, document.title, 'login.html');
            
            // Clear message when user starts typing
            const inputs = loginForm.querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('input', () => {
                    const errorDiv = document.getElementById('login-error');
                    if (errorDiv && errorDiv.classList.contains('success-msg')) {
                        showMessage('login-error', '');
                    }
                }, { once: true });
            });
        }
    }
    
    // Register Flow
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
    try {
        const res = await fetch('/api/session');
        const data = await res.json();
        if (data.session && data.session.user) {
            // Set the token in the supabase client so RLS works
            window.supabaseClient.realtime.setAuth(data.session.token);
            // v2 client uses global headers or setSession
            window.supabaseClient.auth.setSession({ access_token: data.session.token, refresh_token: '' });
            return data.session.user;
        }
    } catch (e) {
        console.error("Session error:", e);
    }
    return null; 
}

async function getUserRole() { 
    const u = await getCurrentUser(); 
    if (!u) return null; 
    
    // Fetch profile
    const { data: profile } = await window.supabaseClient.from('profiles').select('*').eq('id', u.id).single(); 
    if (!profile) return null;

    // Fetch vehicle if student
    if (profile.role === 'student') {
        const { data: vehicle } = await window.supabaseClient.from('vehicles').select('*').eq('user_id', u.id).order('created_at', {ascending: false}).limit(1).single();
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

function getInternalEmail(studentId) {
    return `${studentId.trim().toLowerCase()}@campuspark.local`;
}

// ----- LOGIN -----
async function loginUser(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const studentId = document.getElementById('student_id').value.trim().toUpperCase();
    const password = document.getElementById('password').value;
    
    if (!studentId || !password) return showMessage('login-error', 'Please enter your Student ID and password.');
    
    showMessage('login-error', '');
    if (btn) setLoading(btn, true, 'Logging in...');
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, password })
        });
        
        const data = await res.json();
        if (!res.ok || data.error) {
            return showMessage('login-error', data.error || 'Invalid Student ID or password.');
        }
        
        const p = await getUserRole(); 
        if (!p) return showMessage('login-error', 'Account not found. Please create an account.'); 
        redirectBasedOnRole(p.role); 
    } catch (error) {
        console.error("LOGIN ERROR:", error);
        showMessage('login-error', `System Error: ${error.message || 'Unknown error occurred'}`);
    } finally {
        if (btn) setLoading(btn, false);
    }
}

// ----- REGISTER -----
async function registerUser(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const name = document.getElementById('name').value.trim();
    const studentId = document.getElementById('student_id').value.trim().toUpperCase();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm_password').value;
    const type = document.getElementById('vehicle_type').value;
    const vehicleNumber = document.getElementById('vehicle_number').value.trim().toUpperCase();
    
    if (!name || !studentId || !password || !confirmPassword || !vehicleNumber) {
        return showMessage('register-error', 'Please fill all required fields.');
    }
    
    if (password.length < 6) return showMessage('register-error', 'Password must contain at least 6 characters.');
    if (password !== confirmPassword) return showMessage('register-error', 'Passwords do not match.');
    
    showMessage('register-error', '');
    if (btn) setLoading(btn, true, 'Creating account...');
    
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, studentId, password, type, vehicleNumber })
        });
        
        const data = await res.json();
        
        if (!res.ok || data.error) {
            return showMessage('register-error', data.error || 'Unable to create account. Please try again.');
        }

        window.location.href = 'login.html?registered=true';
    } catch (error) {
        console.error("REGISTER ERROR:", error);
        showMessage('register-error', `System Error: ${error.message || 'Unknown error occurred'}`);
    } finally {
        if (btn) setLoading(btn, false);
    }
}

async function logoutUser() { 
    try {
        await fetch('/api/logout');
    } catch(e) {}
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
