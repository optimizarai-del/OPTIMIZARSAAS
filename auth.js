// auth.js - Frontend Interface to Node.js /api backend

const SESSION_KEY = 'optimizar_session';

// 1. Auth Functions
async function login(email, password) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(data.session));
            return { success: true, role: data.session.role, requiresPasswordChange: data.session.requiresPasswordChange };
        } else {
            return { success: false, message: data.message || 'Error de autenticación' };
        }
    } catch (e) {
        console.error(e);
        return { success: false, message: 'Error conectando al servidor' };
    }
}

async function registerUser(name, email, password, role = 'user', allowedPages = [], extraData = {}) {
    const newUser = {
        name, email, password, role, allowedPages,
        companyName: extraData.companyName || '',
        csvUrl: extraData.csvUrl || '',
        webhookUrl: extraData.webhookUrl || '',
        crmUrl: extraData.crmUrl || '',
        agenteExternoUrl: extraData.agenteExternoUrl || '',
        specialButtons: extraData.specialButtons || [],
        actionButtons: extraData.actionButtons || [],
        customCharts: extraData.customCharts || [],
        requiresPasswordChange: extraData.requiresPasswordChange || false
    };

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser)
        });
        const data = await response.json();
        
        if (data.success) {
            return { success: true, user: data.user };
        } else {
            return { success: false, message: data.message || 'Error al crear usuario' };
        }
    } catch(e) {
        console.error(e);
        return { success: false, message: 'Error conectando al servidor' };
    }
}

function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
}

function getCurrentSession() {
    const sessionText = localStorage.getItem(SESSION_KEY);
    return sessionText ? JSON.parse(sessionText) : null;
}

// 3. Route Protection (Sync checks against local session token)
function requireAuth(allowedRoles = ['admin', 'user'], requiredPage = null) {
    const session = getCurrentSession();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }

    if (session.requiresPasswordChange && !window.location.pathname.endsWith('profile.html')) {
        alert("Por seguridad, debes cambiar tu contraseña predeterminada antes de continuar.");
        window.location.href = 'profile.html';
        return null;
    }
    
    if (!allowedRoles.includes(session.role)) {
        alert("Acceso denegado. No tienes permisos para esta página.");
        if (session.role === 'admin') window.location.href = 'admin.html';
        else window.location.href = 'dashboard.html'; 
        return null;
    }

    if (requiredPage && session.role !== 'admin') {
        if (!session.allowedPages || (!session.allowedPages.includes('all') && !session.allowedPages.includes(requiredPage))) {
            alert(`Acceso denegado: Tu perfil no tiene esta área ("${requiredPage}") asignada.`);
            window.location.href = 'dashboard.html';
            return null;
        }
    }

    return session;
}

// 4. User Management (Admin specific)
async function getAllUsers() {
    try {
        const response = await fetch('/api/users');
        if(!response.ok) return [];
        return await response.json();
    } catch(e) {
        console.error(e);
        return [];
    }
}

async function updateUser(userId, updates) {
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        const data = await response.json();
        
        if (data.success) {
            // Update current session if editing self in LocalStorage
            const session = getCurrentSession();
            if (session && session.userId === userId) {
                if(updates.name) session.name = updates.name;
                if(updates.email) session.email = updates.email;
                if('requiresPasswordChange' in updates) session.requiresPasswordChange = updates.requiresPasswordChange;
                if(updates.companyName !== undefined) session.companyName = updates.companyName;
                if(updates.csvUrl !== undefined) session.csvUrl = updates.csvUrl;
                if(updates.webhookUrl !== undefined) session.webhookUrl = updates.webhookUrl;
                if(updates.crmUrl !== undefined) session.crmUrl = updates.crmUrl;
                if(updates.agenteExternoUrl !== undefined) session.agenteExternoUrl = updates.agenteExternoUrl;
                if(updates.specialButtons !== undefined) session.specialButtons = updates.specialButtons;
                if(updates.actionButtons !== undefined) session.actionButtons = updates.actionButtons;
                if(updates.customCharts !== undefined) session.customCharts = updates.customCharts;
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            }
            return true;
        }
        return false;
    } catch(e) {
        console.error(e);
        return false;
    }
}

async function deleteUser(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) return { success: true };
        else return { success: false, message: data.message || 'Error eliminando usuario' };
    } catch(e) {
        console.error(e);
        return { success: false, message: 'Fallo de red al intentar eliminar' };
    }
}

// Build common UI logic: Top Navigation Updates
function renderAuthenticatedNav(currentPage) {
    const session = getCurrentSession();
    if(!session) return;

    const navElement = document.querySelector('.nav-buttons');
    if (!navElement) return;

    let html = '';
    
    // Admin Link
    if (session.role === 'admin') {
        html += `<a href="admin.html" class="btn-optimizar ${currentPage === 'admin' ? 'active-nav' : ''}">panel admin</a>`;
    }
    
    // Solo mostramos el enlace "dashboard" a los usuarios normales que tienen acceso
    if (session.role === 'user' && session.allowedPages && (session.allowedPages.includes('all') || session.allowedPages.includes('dashboard'))) {
        html += `<a href="dashboard.html" class="btn-optimizar ${currentPage === 'dashboard' ? 'active-nav' : ''}">dashboard</a>`;
    }

    // El perfil es accesible a todos los logueados
    html += `<a href="profile.html" class="btn-optimizar ${currentPage === 'profile' ? 'active-nav' : ''}">mi perfil</a>`;
    
    // Logout Button
    html += `<button onclick="logout()" class="btn-optimizar logout-btn" style="border-color: var(--accent-pink);">salir</button>`;
    
    navElement.innerHTML = html;
}
