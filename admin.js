// admin.js - Lógica específica para el panel unificado de clientes y analíticas

document.addEventListener('DOMContentLoaded', async () => {
  renderAuthenticatedNav('admin');
  switchView('usuarios');
  renderClientsTable();
  renderAdminsTable();
});

// ==========================================================================
// Control de Vistas (Sidebar)
// ==========================================================================
function switchView(viewName) {
  document.getElementById('view-dashboard-admin').style.display = viewName === 'dashboard-admin' ? 'block' : 'none';
  document.getElementById('view-usuarios').style.display = viewName === 'usuarios' ? 'block' : 'none';
  document.getElementById('view-admins').style.display = viewName === 'admins' ? 'block' : 'none';
  document.getElementById('btn-dashboard-admin').classList.toggle('active', viewName === 'dashboard-admin');
  document.getElementById('btn-usuarios').classList.toggle('active', viewName === 'usuarios');
  document.getElementById('btn-admins').classList.toggle('active', viewName === 'admins');
  if (viewName === 'dashboard-admin') {
    loadGlobalMetrics();
  }
}

// ==========================================================================
// Manejo de Modal de Alta (Usuarios / Admins)
// ==========================================================================
const modal = document.getElementById('user-modal');
const form = document.getElementById('user-form');

function openCreateUserModal(roleType) {
  document.getElementById('user-id').value = '';
  form.reset();
  document.getElementById('user-role-hf').value = roleType;
  document.getElementById('modal-title').textContent = roleType === 'admin' ? 'nuevo administrador' : 'nuevo cliente';
  document.getElementById('user-password').value = 'Optimizar123';
  document.getElementById('special-buttons-container').innerHTML = '';
  document.getElementById('action-buttons-container').innerHTML = '';
  document.getElementById('custom-charts-container').innerHTML = '';

  const clientFields = document.getElementById('client-specific-fields');
  if (roleType === 'admin') {
    clientFields.style.display = 'none';
    document.getElementById('user-company').required = false;
  } else {
    clientFields.style.display = 'block';
    document.getElementById('user-company').required = true;
  }
  modal.style.display = 'flex';
}

function closeUserModal() {
  modal.style.display = 'none';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('user-id').value;
  const roleType = document.getElementById('user-role-hf').value;
  const name = document.getElementById('user-name').value;
  const email = document.getElementById('user-email').value;
  const password = document.getElementById('user-password').value;

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'guardando...';
  submitBtn.disabled = true;

  if (id) {
    // Modo Edición
    const updates = { name, email };
    if (password && password !== 'Optimizar123') {
      updates.password = password;
      updates.requiresPasswordChange = false;
    }
    if (roleType === 'user') {
      updates.companyName = document.getElementById('user-company').value;
      updates.csvUrl = document.getElementById('user-csv').value;
      updates.webhookUrl = document.getElementById('user-webhook').value;
      updates.crmUrl = document.getElementById('user-crm').value;
      updates.agenteExternoUrl = document.getElementById('user-agente-externo').value;

      const specialBtns = [];
      document.getElementById('special-buttons-container').querySelectorAll('.special-btn-block').forEach(b => {
        const bName = b.querySelector('.sp-name').value;
        const bUrl = b.querySelector('.sp-url').value;
        if (bName && bUrl) specialBtns.push({ name: bName, url: bUrl });
      });
      updates.specialButtons = specialBtns;

      const actionBtns = [];
      document.getElementById('action-buttons-container').querySelectorAll('.action-btn-block').forEach(b => {
        const bName = b.querySelector('.ab-name').value;
        const bUrl = b.querySelector('.ab-url').value;
        if (bName && bUrl) actionBtns.push({ name: bName, webhookUrl: bUrl });
      });
      updates.actionButtons = actionBtns;

      const customCharts = [];
      document.getElementById('custom-charts-container').querySelectorAll('.custom-chart-block').forEach(b => {
        customCharts.push({
          name: b.querySelector('.cc-name').value.trim(),
          csvUrl: b.querySelector('.cc-csv').value.trim(),
          dateColumn: b.querySelector('.cc-date-col').value.trim(),
          valueColumn: b.querySelector('.cc-val-col').value.trim(),
          aggregation: b.querySelector('.cc-agg').value,
          metricLabel: b.querySelector('.cc-label').value.trim(),
          chartType: b.querySelector('.cc-type').value,
          color: b.querySelector('.cc-color').value
        });
      });
      updates.customCharts = customCharts;
    }
    await updateUser(id, updates);
  } else {
    // Modo Creación
    const allowedPages = roleType === 'admin' ? ['all'] : ['dashboard'];
    const extraData = {};

    if (roleType === 'user') {
      extraData.companyName = document.getElementById('user-company').value;
      extraData.csvUrl = document.getElementById('user-csv').value;
      extraData.webhookUrl = document.getElementById('user-webhook').value;
      extraData.crmUrl = document.getElementById('user-crm').value;
      extraData.agenteExternoUrl = document.getElementById('user-agente-externo').value;
      extraData.requiresPasswordChange = true;

      const specialBtns = [];
      document.getElementById('special-buttons-container').querySelectorAll('.special-btn-block').forEach(b => {
        const bName = b.querySelector('.sp-name').value;
        const bUrl = b.querySelector('.sp-url').value;
        if (bName && bUrl) specialBtns.push({ name: bName, url: bUrl });
      });
      extraData.specialButtons = specialBtns;

      const actionBtns = [];
      document.getElementById('action-buttons-container').querySelectorAll('.action-btn-block').forEach(b => {
        const bName = b.querySelector('.ab-name').value;
        const bUrl = b.querySelector('.ab-url').value;
        if (bName && bUrl) actionBtns.push({ name: bName, webhookUrl: bUrl });
      });
      extraData.actionButtons = actionBtns;

      const customCharts = [];
      document.getElementById('custom-charts-container').querySelectorAll('.custom-chart-block').forEach(b => {
        customCharts.push({
          name: b.querySelector('.cc-name').value.trim(),
          csvUrl: b.querySelector('.cc-csv').value.trim(),
          dateColumn: b.querySelector('.cc-date-col').value.trim(),
          valueColumn: b.querySelector('.cc-val-col').value.trim(),
          aggregation: b.querySelector('.cc-agg').value,
          metricLabel: b.querySelector('.cc-label').value.trim(),
          chartType: b.querySelector('.cc-type').value,
          color: b.querySelector('.cc-color').value
        });
      });
      extraData.customCharts = customCharts;
    }

    const res = await registerUser(name, email, password, roleType, allowedPages, extraData);
    if (!res.success) {
      alert(res.message);
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      return;
    }
    sendWelcomeEmail({ name, email, password, role: roleType });
  }

  submitBtn.textContent = originalText;
  submitBtn.disabled = false;
  closeUserModal();
  await renderClientsTable();
  await renderAdminsTable();
  if (roleType === 'user') loadGlobalMetrics();
});

// ==========================================================================
// Automatización de Correos
// ==========================================================================
function sendWelcomeEmail(userData) {
  const N8N_EMAIL_WEBHOOK = 'https://n8n.optimizar-ia.com/webhook/email-luncher';
  const subject = encodeURIComponent("Tus accesos a Optimizar AI");
  const body = encodeURIComponent(
    `Hola ${userData.name},\n\nTu cuenta en la plataforma Optimizar AI ha sido creada exitosamente.\n\nLink de acceso: https://optimizar-ia.com\nTu correo: ${userData.email}\nTu contraseña temporal: ${userData.password}\n\nPor seguridad, el sistema te pedirá que cambies esta contraseña la primera vez que inicies sesión.\n\nSaludos,\nEl equipo de Optimizar AI`
  );

  if (N8N_EMAIL_WEBHOOK && N8N_EMAIL_WEBHOOK.startsWith('http')) {
    fetch(N8N_EMAIL_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: "new_user_created",
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role,
        loginUrl: "https://optimizar-ia.com"
      })
    }).then(() => console.log('Envío de correo delegado a n8n.'))
      .catch(err => console.error('Error instanciando webhook de correo:', err));
  } else {
    window.open(`mailto:${userData.email}?subject=${subject}&body=${body}`, '_blank');
  }
}

// ==========================================================================
// Edición y Eliminación
// ==========================================================================
async function editUserRecord(userId) {
  const users = await getAllUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return;

  openCreateUserModal(user.role);
  document.getElementById('modal-title').textContent = user.role === 'admin' ? 'editar administrador' : 'editar cliente';
  document.getElementById('user-id').value = user.id;
  document.getElementById('user-name').value = user.name;
  document.getElementById('user-email').value = user.email;
  document.getElementById('user-password').value = '';
  document.getElementById('user-password').placeholder = 'Dejar vacío para no cambiar';

  if (user.role === 'user') {
    document.getElementById('user-company').value = user.companyName || '';
    document.getElementById('user-csv').value = user.csvUrl || '';
    document.getElementById('user-webhook').value = user.webhookUrl || '';
    document.getElementById('user-crm').value = user.crmUrl || '';
    document.getElementById('user-agente-externo').value = user.agenteExternoUrl || '';

    const container = document.getElementById('special-buttons-container');
    container.innerHTML = '';
    if (user.specialButtons && user.specialButtons.length > 0) {
      user.specialButtons.forEach(btn => addSpecialButtonField(btn.name, btn.url));
    }

    const actionContainer = document.getElementById('action-buttons-container');
    actionContainer.innerHTML = '';
    if (user.actionButtons && user.actionButtons.length > 0) {
      user.actionButtons.forEach(btn => addActionButtonField(btn.name, btn.webhookUrl));
    }

    const chartsContainer = document.getElementById('custom-charts-container');
    chartsContainer.innerHTML = '';
    if (user.customCharts && user.customCharts.length > 0) {
      user.customCharts.forEach(chart => addCustomChartField(chart));
    }
  }
}

// ==========================================================================
// Botones Especiales
// ==========================================================================
const btnAddSpecial = document.getElementById('btn-add-special');
if (btnAddSpecial) {
  btnAddSpecial.addEventListener('click', () => {
    const container = document.getElementById('special-buttons-container');
    if (container.children.length < 4) {
      addSpecialButtonField('', '');
    } else {
      alert('Solo se permiten hasta 4 botones especiales por cliente.');
    }
  });
}

// ==========================================================================
// Botones de Acción (Switches n8n)
// ==========================================================================
const btnAddAction = document.getElementById('btn-add-action');
if (btnAddAction) {
  btnAddAction.addEventListener('click', () => {
    const container = document.getElementById('action-buttons-container');
    if (container.children.length < 6) {
      addActionButtonField('', '');
    } else {
      alert('Solo se permiten hasta 6 botones de acción por cliente.');
    }
  });
}

function addActionButtonField(nameVal, webhookUrlVal) {
  const container = document.getElementById('action-buttons-container');
  if (container.children.length >= 6) return;
  const div = document.createElement('div');
  div.className = 'action-btn-block glass-container';
  div.style.cssText = 'padding:10px;margin-bottom:10px;background:rgba(52,211,153,0.05);border:1px solid rgba(52,211,153,0.2);border-radius:8px;position:relative;';
  const switchIdx = Date.now();
  div.innerHTML = `
    <button type="button" onclick="this.parentElement.remove()" style="position:absolute;top:5px;right:5px;background:none;border:none;color:#f87171;cursor:pointer;font-size:1.2rem;line-height:1;">&times;</button>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <span style="color:#34d399;font-size:0.8rem;">⚡</span>
      <input type="text" class="glass-input ab-name" placeholder="Nombre del switch (ej. Envío de Mails)" value="${nameVal || ''}" style="padding:5px 10px;font-size:0.85rem;flex:1;">
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <input type="url" class="glass-input ab-url" placeholder="https://n8n.optimizar-ia.com/webhook/email-switch" value="${webhookUrlVal || ''}" style="padding:5px 10px;font-size:0.85rem;font-family:monospace;flex:1;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;">
        <button type="button" id="admsw-${switchIdx}-btn"
          onclick="adminToggleSwitch('admsw-${switchIdx}', this.closest('.action-btn-block').querySelector('.ab-url').value)"
          style="position:relative;width:44px;height:24px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);cursor:pointer;background:rgba(255,255,255,0.1);transition:background 0.3s,box-shadow 0.3s;outline:none;">
          <span id="admsw-${switchIdx}-knob" style="position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#aaa;transition:transform 0.3s,background 0.3s;"></span>
        </button>
        <span id="admsw-${switchIdx}-status" style="font-size:0.6rem;color:#aaa;">—</span>
      </div>
    </div>
    <p style="font-size:0.7rem;color:rgba(52,211,153,0.7);margin-top:2px;margin-bottom:0;">URL del Webhook GET/POST del workflow switch en n8n</p>
  `;
  container.appendChild(div);
  if (webhookUrlVal) adminFetchSwitchState(`admsw-${switchIdx}`, webhookUrlVal);
}

async function adminFetchSwitchState(switchId, webhookUrl) {
  try {
    const res = await fetch(webhookUrl, { method: 'GET' });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const item = Array.isArray(data) ? data[0] : data;
    const isOn = item.estado_nuevo
      ? item.estado_nuevo === 'ON'
      : (item.emailEnabled ?? item.enabled ?? item.active ?? false);
    adminUpdateSwitchUI(switchId, isOn, item.mensaje);
  } catch {
    const s = document.getElementById(`${switchId}-status`);
    if (s) { s.textContent = 'sin conexión'; s.style.color = '#aaa'; }
  }
}

async function adminToggleSwitch(switchId, webhookUrl) {
  if (!webhookUrl) return;
  const btnEl = document.getElementById(`${switchId}-btn`);
  const statusEl = document.getElementById(`${switchId}-status`);
  if (btnEl) btnEl.disabled = true;
  if (statusEl) { statusEl.textContent = '...'; statusEl.style.color = '#aaa'; }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle' })
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const item = Array.isArray(data) ? data[0] : data;
    const isOn = item.estado_nuevo
      ? item.estado_nuevo === 'ON'
      : (item.emailEnabled ?? item.enabled ?? item.active ?? false);
    adminUpdateSwitchUI(switchId, isOn, item.mensaje);
  } catch {
    if (statusEl) { statusEl.textContent = 'error'; statusEl.style.color = '#f87171'; }
  } finally {
    if (btnEl) btnEl.disabled = false;
  }
}

function adminUpdateSwitchUI(switchId, isOn, mensaje) {
  const btnEl = document.getElementById(`${switchId}-btn`);
  const knobEl = document.getElementById(`${switchId}-knob`);
  const statusEl = document.getElementById(`${switchId}-status`);
  if (!btnEl || !knobEl) return;
  if (isOn) {
    btnEl.style.background = 'rgba(52,211,153,0.35)';
    btnEl.style.borderColor = '#34d399';
    btnEl.style.boxShadow = '0 0 10px 2px rgba(52,211,153,0.5)';
    knobEl.style.transform = 'translateX(20px)';
    knobEl.style.background = '#34d399';
    if (statusEl) { statusEl.textContent = mensaje || 'ON'; statusEl.style.color = '#34d399'; }
  } else {
    btnEl.style.background = 'rgba(248,113,113,0.2)';
    btnEl.style.borderColor = '#f87171';
    btnEl.style.boxShadow = '0 0 10px 2px rgba(248,113,113,0.4)';
    knobEl.style.transform = 'translateX(0)';
    knobEl.style.background = '#f87171';
    if (statusEl) { statusEl.textContent = mensaje || 'OFF'; statusEl.style.color = '#f87171'; }
  }
}

function addSpecialButtonField(nameVal, urlVal) {
  const container = document.getElementById('special-buttons-container');
  if (container.children.length >= 4) return;
  const div = document.createElement('div');
  div.className = 'special-btn-block glass-container';
  div.style.padding = '10px';
  div.style.marginBottom = '10px';
  div.style.background = 'rgba(0,0,0,0.1)';
  div.style.position = 'relative';
  div.innerHTML = `
    <button type="button" onclick="this.parentElement.remove()" style="position:absolute;top:5px;right:5px;background:none;border:none;color:#f87171;cursor:pointer;font-size:1.2rem;line-height:1;">&times;</button>
    <div style="margin-bottom:5px;">
      <input type="text" class="glass-input sp-name" placeholder="Nombre del botón (ej. Reporte XLS)" value="${nameVal}" required style="padding:5px 10px;font-size:0.85rem;">
    </div>
    <div>
      <input type="url" class="glass-input sp-url" placeholder="https://..." value="${urlVal}" required style="padding:5px 10px;font-size:0.85rem;">
    </div>
  `;
  container.appendChild(div);
}

async function removeUserRecord(userId) {
  if (confirm("¿Estás seguro que deseas eliminar este registro permanentemente?")) {
    const res = await deleteUser(userId);
    if (res.success) {
      await renderClientsTable();
      await renderAdminsTable();
      loadGlobalMetrics();
    } else {
      alert(res.message);
    }
  }
}

function viewClientDashboard(clientId) {
  window.location.href = `dashboard.html?clientId=${clientId}`;
}

// ==========================================================================
// Tablas (Admins & Clientes)
// ==========================================================================
async function renderAdminsTable() {
  const all = await getAllUsers();
  const admins = all.filter(u => u.role === 'admin');
  const tbody = document.getElementById('admins-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  admins.forEach(admin => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${admin.name}</td>
      <td>${admin.email}</td>
      <td><span style="color:var(--accent-pink);font-weight:600;">${admin.role}</span></td>
      <td>
        <button onclick="editUserRecord('${admin.id}')" class="btn-optimizar" style="padding:5px 15px;font-size:0.8rem;">editar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function renderClientsTable() {
  const all = await getAllUsers();
  const clients = all.filter(u => u.role === 'user');
  const tbody = document.getElementById('clients-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  clients.forEach(client => {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    let crmBtn = `<span style="opacity:0.4;font-size:0.8rem;">Sin CRM</span>`;
    if (client.crmUrl) {
      crmBtn = `<a href="${client.crmUrl}" target="_blank" class="btn-crm" onclick="event.stopPropagation()">Abrir CRM</a>`;
    }
    const displayName = client.companyName ? `${client.companyName} (${client.name})` : client.name;
    tr.innerHTML = `
      <td onclick="viewClientDashboard('${client.id}')" style="font-weight:600;color:var(--accent-blue);">${displayName}</td>
      <td onclick="viewClientDashboard('${client.id}')">${client.email}</td>
      <td>${crmBtn}</td>
      <td>
        <a href="requerimientos.html?userId=${client.id}" class="btn-optimizar" style="padding:5px 15px;font-size:0.8rem;background:rgba(167,139,250,0.15);border-color:#a78bfa;text-decoration:none;">Ver Requerimientos</a>
        <button onclick="editUserRecord('${client.id}')" class="btn-optimizar" style="padding:5px 15px;font-size:0.8rem;margin-left:5px;">Editar</button>
        <button onclick="removeUserRecord('${client.id}')" class="btn-optimizar" style="padding:5px 15px;font-size:0.8rem;background:rgba(244,114,182,0.1);border-color:var(--accent-pink);margin-left:5px;">Borrar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================================================
// Gráfico Global Multi-Línea — Dashboard Admin
// ==========================================================================
let globalAdminChart = null;
let allClientsDataCache = {};

const chartColors = [
  '#38bdf8', '#f472b6', '#a855f7', '#34d399', '#fbbf24',
  '#fb7185', '#60a5fa', '#818cf8', '#c084fc', '#f43f5e'
];

// [FIX BUG A] Convierte URL de Google Sheets a la URL del proxy interno.
// Esto evita el bloqueo CORS que ocurre al hacer fetch directo desde el navegador.
function getProxiedCsvUrlAdmin(url) {
  if (!url) return '';
  let cleanUrl = url.trim();
  if (cleanUrl.includes('docs.google.com/spreadsheets')) {
    if (cleanUrl.includes('/pubhtml')) {
      cleanUrl = cleanUrl.replace(/\/pubhtml.*$/, '/pub?output=csv');
    } else if (cleanUrl.includes('/pub?') && !cleanUrl.includes('output=csv')) {
      cleanUrl = cleanUrl.split('?')[0] + '?output=csv';
    } else if (cleanUrl.includes('/edit') || cleanUrl.includes('/view')) {
      cleanUrl = cleanUrl.replace(/\/(edit|view).*$/, '/export?format=csv');
    }
  }
  return `/api/proxy-csv?url=${encodeURIComponent(cleanUrl)}`;
}

async function loadGlobalMetrics() {
  const allu = await getAllUsers();
  const clients = allu.filter(u => u.role === 'user');
  const trigger = document.getElementById('admin-client-multi-trigger');
  const dropdown = document.getElementById('admin-client-multi-dropdown');

  // Repoblar Dropdown
  dropdown.innerHTML = `
    <label style="padding:8px 15px;cursor:pointer;display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(255,255,255,0.1);">
      <input type="checkbox" id="selectAllClients" checked>
      <span style="font-weight:600;">Todos los clientes</span>
    </label>
  `;
  clients.forEach(c => {
    dropdown.innerHTML += `
      <label style="padding:8px 15px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:background 0.2s;"
        onmouseover="this.style.background='rgba(255,255,255,0.05)'"
        onmouseout="this.style.background='transparent'">
        <input type="checkbox" class="client-checkbox" value="${c.id}" checked>
        <span>${c.companyName || c.name}</span>
      </label>
    `;
  });

  // Lógica UI de Select Múltiple
  trigger.onclick = () => {
    dropdown.style.display = dropdown.style.display === 'flex' ? 'none' : 'flex';
  };
  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  const selectAll = document.getElementById('selectAllClients');
  const checkboxes = document.querySelectorAll('.client-checkbox');
  const label = document.getElementById('admin-multi-label');

  function updateSelection() {
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    if (checked.length === checkboxes.length) {
      selectAll.checked = true;
      label.textContent = "Todos los clientes";
    } else if (checked.length === 0) {
      selectAll.checked = false;
      label.textContent = "Ningún cliente";
    } else {
      selectAll.checked = false;
      label.textContent = `${checked.length} seleccionado(s)`;
    }
    triggerGlobalChartUpdate();
  }

  selectAll.addEventListener('change', (e) => {
    checkboxes.forEach(cb => cb.checked = e.target.checked);
    updateSelection();
  });
  checkboxes.forEach(cb => cb.addEventListener('change', updateSelection));

  // [FIX BUG A] Descargar todos los CSVs via proxy para evitar CORS
  const fetchPromises = clients.map(client => {
    return new Promise(resolve => {
      if (!client.csvUrl) {
        resolve({ clientId: client.id, data: [], name: client.companyName || client.name });
        return;
      }

      const proxiedUrl = getProxiedCsvUrlAdmin(client.csvUrl);
      console.log(`Cargando CSV de ${client.companyName || client.name} via proxy:`, proxiedUrl);

      Papa.parse(proxiedUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          const normData = results.data.map(row => {
            const nr = {};
            for (let k in row) nr[k.toLowerCase().trim()] = row[k];
            return nr;
          });
          resolve({ clientId: client.id, data: normData, name: client.companyName || client.name });
        },
        error: function(err) {
          console.warn(`Error cargando CSV de ${client.companyName || client.name}:`, err);
          resolve({ clientId: client.id, data: [], name: client.companyName || client.name });
        }
      });
    });
  });

  const parsedResults = await Promise.all(fetchPromises);

  allClientsDataCache = {};
  parsedResults.forEach(res => {
    allClientsDataCache[res.clientId] = { rawData: res.data, name: res.name };
  });

  // Enganchar listeners de fecha
  const stEl = document.getElementById('start-date-global');
  const enEl = document.getElementById('end-date-global');
  if (stEl) stEl.addEventListener('input', triggerGlobalChartUpdate);
  if (enEl) enEl.addEventListener('input', triggerGlobalChartUpdate);

  triggerGlobalChartUpdate();
}

function triggerGlobalChartUpdate() {
  const checkboxes = document.querySelectorAll('.client-checkbox');
  const selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
  const startVal = document.getElementById('start-date-global').value;
  const endVal = document.getElementById('end-date-global').value;
  processGlobalChartData(allClientsDataCache, selectedIds, startVal, endVal);
}

function safeParseDate(rawDate) {
  if (!rawDate) return null;
  let str = String(rawDate).trim().split(' ')[0].split('T')[0];
  const partsSlash = str.split('/');
  const partsDash = str.split('-');
  let d;
  if (partsSlash.length === 3) {
    d = new Date(`${partsSlash[2]}-${partsSlash[1]}-${partsSlash[0]}T12:00:00`);
  } else if (partsDash.length === 3 && partsDash[0].length === 2) {
    d = new Date(`${partsDash[2]}-${partsDash[1]}-${partsDash[0]}T12:00:00`);
  } else {
    d = new Date(str + 'T12:00:00');
    if (isNaN(d)) d = new Date(str);
  }
  if (isNaN(d)) return null;
  return d;
}

function processGlobalChartData(cache, selectedClientIds, startVal, endVal) {
  if (!selectedClientIds || selectedClientIds.length === 0) {
    document.getElementById('global-total-msg').textContent = "0";
    document.getElementById('chart-legend').innerHTML = "";
    renderAdminChart([], []);
    return;
  }

  let start = startVal ? new Date(startVal + 'T00:00:00') : null;
  let end = endVal ? new Date(endVal + 'T23:59:59') : null;
  let grmessages = 0;

  let allDatesSet = new Set();
  const clientStats = {};

  selectedClientIds.forEach(cId => {
    clientStats[cId] = {};
    if (!cache[cId]) return;

    const cData = cache[cId].rawData;
    const clientNameLower = (cache[cId].name || '').toLowerCase();

    // [FIX BUG B] Filtro de sender robusto: si no existe la columna, mostrar todo
    const agentOnlyData = cData.filter(row => {
      const sender = (row['usuario'] || row['remitente'] || row['role'] || row['sender'] || '').toLowerCase().trim();

      // Si ninguna columna de sender existe en la fila, incluir el registro
      const hasSenderColumn = 'usuario' in row || 'remitente' in row || 'role' in row || 'sender' in row;
      if (!hasSenderColumn) return true;

      // Si la columna existe pero está vacía, excluir
      if (sender === '') return false;

      // Excluir mensajes del cliente/usuario genérico
      return sender !== clientNameLower && sender !== 'user' && sender !== 'cliente';
    });

    agentOnlyData.forEach(row => {
      let raw = row.fecha || row.date || row.Fecha || row.Date || '';
      let d = safeParseDate(raw);
      if (!d) return;

      if (start && d < start) return;
      if (end && d > end) return;

      grmessages++;
      let formattedDate = d.toISOString().split('T')[0];
      allDatesSet.add(formattedDate);
      if (!clientStats[cId][formattedDate]) clientStats[cId][formattedDate] = 0;
      clientStats[cId][formattedDate]++;
    });
  });

  document.getElementById('global-total-msg').textContent = grmessages.toLocaleString();

  const masterDates = Array.from(allDatesSet).sort((a, b) => new Date(a) - new Date(b));
  const labels = masterDates.map(date => {
    const [y, m, d] = date.split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
    return date;
  });

  const datasets = [];
  let colorIndex = 0;
  const legendContainer = document.getElementById('chart-legend');
  legendContainer.innerHTML = '';

  selectedClientIds.forEach((cId, idx) => {
    if (!cache[cId]) return;
    const clientName = cache[cId].name;
    const color = chartColors[colorIndex % chartColors.length];
    colorIndex++;

    const dataArr = masterDates.map(date => clientStats[cId][date] || 0);
    datasets.push({
      label: clientName,
      data: dataArr,
      borderColor: color,
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointBackgroundColor: color,
      pointRadius: 3,
      tension: 0.3,
      hidden: false
    });

    legendContainer.innerHTML += `
      <div class="legend-item" id="legend-${idx}" onclick="toggleDataset(${idx}, this)">
        <div class="legend-color" style="background:${color};"></div>
        <span>${clientName}</span>
      </div>
    `;
  });

  // Auto-completar fechas si los inputs están vacíos
  if (masterDates.length > 0) {
    const stEl = document.getElementById('start-date-global');
    const enEl = document.getElementById('end-date-global');
    if (stEl && !stEl.value && enEl && !enEl.value) {
      let startAuto = new Date(masterDates[0]);
      let endAuto = new Date(masterDates[masterDates.length - 1]);
      startAuto.setDate(startAuto.getDate() - 1);
      endAuto.setDate(endAuto.getDate() + 1);
      stEl.value = startAuto.toISOString().split('T')[0];
      enEl.value = endAuto.toISOString().split('T')[0];
    }
  }

  renderAdminChart(labels, datasets);
}

function renderAdminChart(labels, datasets) {
  const canvas = document.getElementById('globalChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (globalAdminChart) globalAdminChart.destroy();

  Chart.defaults.color = 'rgba(255,255,255,0.7)';
  Chart.defaults.font.family = "'Poppins', sans-serif";

  globalAdminChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(30,30,45,0.9)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255,255,255,0.2)',
          borderWidth: 1
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false } },
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }
      },
      interaction: { mode: 'nearest', axis: 'x', intersect: false }
    }
  });
}

function toggleDataset(index, element) {
  const meta = globalAdminChart.getDatasetMeta(index);
  meta.hidden = meta.hidden === null ? !globalAdminChart.data.datasets[index].hidden : null;
  globalAdminChart.update();
  element.classList.toggle('hidden');
}

// ==========================================================================
// Gráficos Personalizados — Lógica del Modal
// ==========================================================================
const btnAddChart = document.getElementById('btn-add-chart');
if (btnAddChart) {
  btnAddChart.addEventListener('click', () => {
    const container = document.getElementById('custom-charts-container');
    if (container.children.length < 8) {
      addCustomChartField({});
    } else {
      alert('Máximo 8 gráficos personalizados por cliente.');
    }
  });
}

function addCustomChartField(cfg) {
  cfg = cfg || {};
  const container = document.getElementById('custom-charts-container');
  if (container.children.length >= 8) return;

  const div = document.createElement('div');
  div.className = 'custom-chart-block';
  div.style.cssText = 'padding:14px;margin-bottom:12px;background:rgba(167,139,250,0.05);border:1px solid rgba(167,139,250,0.2);border-radius:10px;position:relative;';

  const agg = cfg.aggregation || 'count';
  const ctype = cfg.chartType || 'line';
  const color = cfg.color || '#a78bfa';

  div.innerHTML = `
    <button type="button" onclick="this.parentElement.remove()" style="position:absolute;top:8px;right:8px;background:none;border:none;color:#f87171;cursor:pointer;font-size:1.1rem;line-height:1;">&times;</button>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
      <div>
        <label style="font-size:0.72rem;color:rgba(167,139,250,0.9);display:block;margin-bottom:3px;">nombre del gráfico *</label>
        <input type="text" class="glass-input cc-name" placeholder="ej: Cargas de Combustible" value="${cfg.name || ''}" style="padding:6px 10px;font-size:0.82rem;width:100%;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:0.72rem;color:rgba(167,139,250,0.9);display:block;margin-bottom:3px;">etiqueta de la métrica *</label>
        <input type="text" class="glass-input cc-label" placeholder="ej: litros, reportes, ventas" value="${cfg.metricLabel || ''}" style="padding:6px 10px;font-size:0.82rem;width:100%;box-sizing:border-box;">
      </div>
    </div>
    <div style="margin-bottom:8px;">
      <label style="font-size:0.72rem;color:rgba(167,139,250,0.9);display:block;margin-bottom:3px;">url google sheets (csv público) *</label>
      <input type="url" class="glass-input cc-csv" placeholder="https://docs.google.com/spreadsheets/.../pub?output=csv" value="${cfg.csvUrl || ''}" style="padding:6px 10px;font-size:0.78rem;font-family:monospace;width:100%;box-sizing:border-box;">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
      <div>
        <label style="font-size:0.72rem;color:rgba(167,139,250,0.9);display:block;margin-bottom:3px;">columna de fecha *</label>
        <input type="text" class="glass-input cc-date-col" placeholder="ej: fecha, Fecha, Date" value="${cfg.dateColumn || ''}" style="padding:6px 10px;font-size:0.82rem;width:100%;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:0.72rem;color:rgba(167,139,250,0.9);display:block;margin-bottom:3px;">columna de valor (o COUNT)</label>
        <input type="text" class="glass-input cc-val-col" placeholder="ej: litros, monto — o COUNT" value="${cfg.valueColumn || 'COUNT'}" style="padding:6px 10px;font-size:0.82rem;width:100%;box-sizing:border-box;">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 80px;gap:8px;">
      <div>
        <label style="font-size:0.72rem;color:rgba(167,139,250,0.9);display:block;margin-bottom:3px;">agregación</label>
        <select class="glass-input cc-agg" style="padding:6px 10px;font-size:0.82rem;width:100%;background:rgba(0,0,0,0.3);cursor:pointer;">
          <option value="count" ${agg === 'count' ? 'selected' : ''}>count (contar filas)</option>
          <option value="sum"   ${agg === 'sum'   ? 'selected' : ''}>sum (sumar valores)</option>
          <option value="avg"   ${agg === 'avg'   ? 'selected' : ''}>avg (promedio)</option>
        </select>
      </div>
      <div>
        <label style="font-size:0.72rem;color:rgba(167,139,250,0.9);display:block;margin-bottom:3px;">tipo de gráfico</label>
        <select class="glass-input cc-type" style="padding:6px 10px;font-size:0.82rem;width:100%;background:rgba(0,0,0,0.3);cursor:pointer;">
          <option value="line" ${ctype === 'line' ? 'selected' : ''}>lineas</option>
          <option value="bar"  ${ctype === 'bar'  ? 'selected' : ''}>barras</option>
        </select>
      </div>
      <div>
        <label style="font-size:0.72rem;color:rgba(167,139,250,0.9);display:block;margin-bottom:3px;">color</label>
        <input type="color" class="cc-color" value="${color}" style="width:100%;height:36px;border:1px solid rgba(255,255,255,0.15);border-radius:6px;background:none;cursor:pointer;padding:2px;">
      </div>
    </div>
  `;
  container.appendChild(div);
}
