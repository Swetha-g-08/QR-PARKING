document.addEventListener('DOMContentLoaded', () => { 
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
    const studentId = sessionStorage.getItem('currentStudentId');
    if (!studentId) return null;
    
    try {
        const res = await fetch(`/api/profile?studentId=${studentId}`);
        if (!res.ok) return null;
        
        const profile = await res.json();
        return profile;
    } catch (e) {
        console.error("Profile fetch error:", e);
    }
    return null; 
}

async function getUserRole() { 
    const u = await getCurrentUser(); 
    if (!u) return null; 
    return u;
}

function redirectBasedOnRole(role) { 
    location.href = role === 'admin' ? 'admin.html' : role === 'security' ? 'security.html' : role === 'student' ? 'dashboard.html' : 'index.html'; 
}

function getInternalEmail(studentId) {
    return `${studentId.trim().toLowerCase()}@campuspark.local`;
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

        sessionStorage.setItem('currentStudentId', studentId);
        window.location.href = 'dashboard.html';
    } catch (error) {
        console.error("REGISTER ERROR:", error);
        showMessage('register-error', `System Error: ${error.message || 'Unknown error occurred'}`);
    } finally {
        if (btn) setLoading(btn, false);
    }
}

async function logoutUser() { 
    sessionStorage.clear();
    location.href = 'index.html'; 
}

async function checkAuthAndRole(expected) { 
    const p = await getUserRole(); 
    if (!p) { 
        location.href = 'register.html'; 
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
                <a href="register.html" class="dropdown-item" style="text-decoration: none;">
                    <i data-lucide="home" size="16"></i> Home
                </a>
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
