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

// Agregar miembro a un proyecto existente (no crea proyecto nuevo)
async function addProjectMember(projectId, name, email, password) {
    try {
        const response = await fetch(`/api/projects/${projectId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await response.json();
        if (data.success) return { success: true, member: data.member };
        else return { success: false, message: data.message || 'Error al agregar miembro' };
    } catch(e) {
        console.error(e);
        return { success: false, message: 'Error de red' };
    }
}

// Eliminar miembro de un proyecto (solo miembros no-propietarios)
async function removeProjectMember(projectId, userId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) return { success: true };
        else return { success: false, message: data.message || 'Error al eliminar miembro' };
    } catch(e) {
        console.error(e);
        return { success: false, message: 'Error de red' };
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
        html += `<a href="requerimientos.html" class="btn-optimizar ${currentPage === 'requerimientos' ? 'active-nav' : ''}">requerimientos</a>`;
    }

    // Bell notification (all logged-in users)
    html += `
      <div class="notif-bell-wrap" id="notif-bell-wrap">
        <button class="notif-bell-btn" id="notif-bell-btn" onclick="toggleNotifDropdown(event)" title="Notificaciones">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span class="notif-badge" id="notif-badge" style="display:none;">0</span>
        </button>
        <div class="notif-dropdown" id="notif-dropdown" style="display:none;">
          <div class="notif-dropdown-header">
            <span>Notificaciones</span>
            <button class="notif-mark-all" onclick="markAllNotifsRead()">Marcar Todo Leído</button>
          </div>
          <div id="notif-list"><p style="padding:16px;color:rgba(255,255,255,0.4);font-size:0.85rem;">Sin notificaciones.</p></div>
        </div>
      </div>
    `;

    // El perfil es accesible a todos los logueados
    html += `<a href="profile.html" class="btn-optimizar ${currentPage === 'profile' ? 'active-nav' : ''}">mi perfil</a>`;

    // Logout Button
    html += `<button onclick="logout()" class="btn-optimizar logout-btn" style="border-color: var(--accent-pink);">salir</button>`;

    navElement.innerHTML = html;
    // Initialize notification bell after DOM is ready
    setTimeout(initNotificationBell, 0);
}

// ──────────────────────────────────────────────────────────────────────────
// NOTIFICATION BELL SYSTEM
// ──────────────────────────────────────────────────────────────────────────
let _notifInterval = null;

function initNotificationBell() {
  const session = getCurrentSession();
  if (!session) return;
  fetchNotifications();
  _notifInterval = setInterval(fetchNotifications, 30000);
  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('notif-bell-wrap');
    if (wrap && !wrap.contains(e.target)) {
      const dd = document.getElementById('notif-dropdown');
      if (dd) dd.style.display = 'none';
    }
  });
}

async function fetchNotifications() {
  const session = getCurrentSession();
  if (!session) return;
  try {
    const res = await fetch(`/api/notifications?userId=${session.userId}`);
    if (!res.ok) return;
    const notifications = await res.json();
    const unread = notifications.filter(n => !n.readAt).length;
    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.style.display = unread > 0 ? 'flex' : 'none';
      badge.textContent = unread > 9 ? '9+' : unread;
    }
    renderNotifList(notifications);
  } catch(e) {}
}

function renderNotifList(notifications) {
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!notifications.length) {
    list.innerHTML = '<p style="padding:16px;color:rgba(255,255,255,0.4);font-size:0.85rem;">Sin notificaciones.</p>';
    return;
  }
  const typeIcons = {
    new_requirement: '📋',
    new_client: '👤',
    new_user: '👥',
    new_comment: '💬',
    mention: '🔔'
  };
  list.innerHTML = notifications.slice(0, 20).map(n => {
    const date = new Date(n.createdAt);
    const timeAgo = formatTimeAgo(date);
    const icon = typeIcons[n.type] || '🔔';
    const unreadClass = !n.readAt ? 'notif-item unread' : 'notif-item';
    return `
      <div class="${unreadClass}" onclick="handleNotifClick('${n.id}', '${n.link}')">
        <span class="notif-icon">${icon}</span>
        <div class="notif-content">
          <p class="notif-msg">${escapeNotif(n.message)}</p>
          <span class="notif-time">${timeAgo}</span>
        </div>
        ${!n.readAt ? '<span class="notif-dot"></span>' : ''}
      </div>
    `;
  }).join('');
}

function escapeNotif(text) {
  return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatTimeAgo(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff/3600)}h`;
  return date.toLocaleDateString('es-AR', {day:'2-digit', month:'2-digit'});
}

async function handleNotifClick(notifId, link) {
  try { await fetch(`/api/notifications/${notifId}/read`, { method: 'PATCH' }); } catch(e) {}
  await fetchNotifications();
  if (link) window.location.href = link;
}

async function markAllNotifsRead() {
  const session = getCurrentSession();
  if (!session) return;
  try {
    await fetch('/api/notifications/read-all', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session.userId })
    });
    await fetchNotifications();
  } catch(e) {}
}

function toggleNotifDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('notif-dropdown');
  const btn = document.getElementById('notif-bell-btn');
  if (!dd || !btn) return;
  const isHidden = dd.style.display === 'none' || dd.style.display === '';
  if (isHidden) {
    const rect = btn.getBoundingClientRect();
    dd.style.top = (rect.bottom + 8) + 'px';
    dd.style.right = (window.innerWidth - rect.right) + 'px';
    dd.style.left = 'auto';
    dd.style.display = 'block';
    fetchNotifications();
  } else {
    dd.style.display = 'none';
  }
}
