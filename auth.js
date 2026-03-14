// auth.js - Simulated Backend & Session Management using LocalStorage

const USERS_DB_KEY = 'optimizar_users';
const SESSION_KEY = 'optimizar_session';

// 1. Initialize Mock Database with default Admin & Client
function initDB() {
    let users = localStorage.getItem(USERS_DB_KEY);
    if (!users) {
        users = [
            {
                id: crypto.randomUUID(),
                name: 'Federico Rodriguez (Owner)',
                email: 'rodriguezfederico765@gmail.com',
                password: 'Optimizar-26',
                role: 'admin',
                allowedPages: ['all'],
                createdAt: new Date().toISOString()
            },
            {
                id: crypto.randomUUID(),
                name: 'Admin Principal',
                email: 'admin@optimizar-ia.com',
                password: 'admin',
                role: 'admin',
                allowedPages: ['all'], 
                createdAt: new Date().toISOString()
            },
            {
                id: crypto.randomUUID(),
                name: 'Gabriel Riesco',
                companyName: 'Gabriel Riesco IA',
                email: 'gabrielriescoia@gmail.com',
                password: 'Optimizar-26',
                role: 'user',
                allowedPages: ['dashboard'],
                csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRylHtAg4p3VGtm4pKxMUgTyLyGN9CLGv4k1dDFRzKozzRPJZBlStGXJrjHL-gId5QPsV7IZRO-nPR3/pub?output=csv',
                webhookUrl: 'https://n8n.optimizar-ia.com/webhook/e69975da-3359-43cf-9970-f60ef990f726',
                requiresPasswordChange: false,
                createdAt: new Date().toISOString()
            }
        ];
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
    }
}

// 2. Auth Functions
function login(email, password) {
    const users = JSON.parse(localStorage.getItem(USERS_DB_KEY));
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        // Create session
        const session = {
            userId: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            companyName: user.companyName || '',
            allowedPages: user.allowedPages || [],
            csvUrl: user.csvUrl || '',
            webhookUrl: user.webhookUrl || '',
            crmUrl: user.crmUrl || '',
            agenteExternoUrl: user.agenteExternoUrl || '',
            specialButtons: user.specialButtons || [],
            requiresPasswordChange: user.requiresPasswordChange || false,
            loginTime: new Date().toISOString()
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { success: true, role: user.role, requiresPasswordChange: session.requiresPasswordChange };
    }
    return { success: false, message: 'Correo o contraseña incorrectos.' };
}

function registerUser(name, email, password, role = 'user', allowedPages = [], extraData = {}) {
    const users = JSON.parse(localStorage.getItem(USERS_DB_KEY));
    
    if (users.find(u => u.email === email)) {
        return { success: false, message: 'El correo ya está registrado.' };
    }

    const newUser = {
        id: crypto.randomUUID(),
        name: name,
        email: email,
        password: password,
        role: role,
        allowedPages: allowedPages,
        companyName: extraData.companyName || '',
        csvUrl: extraData.csvUrl || '',
        webhookUrl: extraData.webhookUrl || '',
        crmUrl: extraData.crmUrl || '',
        agenteExternoUrl: extraData.agenteExternoUrl || '',
        specialButtons: extraData.specialButtons || [],
        requiresPasswordChange: extraData.requiresPasswordChange || false,
        createdAt: new Date().toISOString()
    };

    
    users.push(newUser);
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
    return { success: true, user: newUser };
}

function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
}

function getCurrentSession() {
    const sessionText = localStorage.getItem(SESSION_KEY);
    return sessionText ? JSON.parse(sessionText) : null;
}

// 3. Route Protection
function requireAuth(allowedRoles = ['admin', 'user'], requiredPage = null) {
    const session = getCurrentSession();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }

    // Si requiere cambio de contraseña, forzar a ir al perfil (excepto si ya está en el perfil)
    if (session.requiresPasswordChange && !window.location.pathname.endsWith('profile.html')) {
        alert("Por seguridad, debes cambiar tu contraseña predeterminada antes de continuar.");
        window.location.href = 'profile.html';
        return null;
    }
    
    // Verificación de Rol
    if (!allowedRoles.includes(session.role)) {
        alert("Acceso denegado. No tienes permisos para esta página.");
        
        // Si no tiene permiso pero es admin, al admin, si es usuario al dashboard genérico si existe
        if (session.role === 'admin') window.location.href = 'admin.html';
        else window.location.href = 'dashboard.html'; 
        return null;
    }

    // Verificación de Acceso a Página Específica (para usuarios)
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
function getAllUsers() {
    return JSON.parse(localStorage.getItem(USERS_DB_KEY)) || [];
}

function updateUser(userId, updates) {
    const users = JSON.parse(localStorage.getItem(USERS_DB_KEY));
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
        users[index] = { ...users[index], ...updates };
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
        
        // Update current session if editing self
        const session = getCurrentSession();
        if (session && session.userId === userId) {
            session.name = users[index].name;
            session.email = users[index].email;
            session.requiresPasswordChange = users[index].requiresPasswordChange;
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
        return true;
    }
    return false;
}

function deleteUser(userId) {
    const users = JSON.parse(localStorage.getItem(USERS_DB_KEY));
    const filtered = users.filter(u => u.id !== userId);
    
    // Prevent deleting the very last admin
    if (filtered.filter(u => u.role === 'admin').length === 0) {
         return { success: false, message: "No puedes eliminar el último administrador." };
    }

    localStorage.setItem(USERS_DB_KEY, JSON.stringify(filtered));
    return { success: true };
}

// Auto-init on script load
initDB();

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
