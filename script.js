// ==========================================================================
// Configuración Principal Dinámica (Multi-Tenant)
// ==========================================================================
let CSV_URL = '';
let WEBHOOK_URL = '';
let currentUserId = null;
let currentUserName = '';
const SESSION_ID = crypto.randomUUID ? crypto.randomUUID() : 'session-' + new Date().getTime();

// Variables Globales
let chartInstance = null;
let globalData = [];

// Elementos del DOM
const totalMessagesEl = document.getElementById('total-messages');
const startDateEl = document.getElementById('start-date');
const endDateEl = document.getElementById('end-date');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatHistory = document.getElementById('chat-history');

// ==========================================================================
// Lógica de Datos (CSV y Gráficos)
// ==========================================================================
async function initializeDashboardConfig() {
  const session = typeof getCurrentSession === 'function' ? getCurrentSession() : null;
  if (!session) {
    console.error("No hay sesión activa. script.js requiere auth.js");
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const inspectClientId = urlParams.get('clientId');

  // MODO ADMIN: Viendo el dashboard de un cliente en particular
  if (session.role === 'admin') {
    if (inspectClientId) {
      console.log("Admin detectado, buscando cliente:", inspectClientId);
      const users = typeof getAllUsers === 'function' ? await getAllUsers() : [];
      const client = users.find(u => String(u.id) === String(inspectClientId));

      if (client) {
        CSV_URL = client.csvUrl || '';
        WEBHOOK_URL = client.webhookUrl || '';
        currentUserId = client.id;
        currentUserName = client.companyName || client.name;

        // [FIX BUG 4] Inicializar siempre con datos frescos de la DB
        initActionSwitches(client.actionButtons || []);
        initCustomCharts(client.customCharts || []);

        const titleElement = document.getElementById('dashboard-client-title');
        if (titleElement) titleElement.textContent = `dashboard: ${currentUserName}`;

        // Mostrar sidebar de navegación del cliente para el admin
        const clientSidebar = document.getElementById('client-sidebar');
        if (clientSidebar) {
          clientSidebar.style.display = 'flex';
          clientSidebar.innerHTML = `
            <a href="admin.html" class="sidebar-btn" style="text-decoration:none;font-size:0.9rem;">← Panel Admin</a>
            <button class="sidebar-btn active">Dashboard</button>
            <a href="requerimientos.html?userId=${client.id}" class="sidebar-btn" style="text-decoration:none;">Requerimientos</a>
          `;
        }

        const linksContainer = document.getElementById('dashboard-external-links');
        if (linksContainer) {
          linksContainer.innerHTML = '';
          if (client.agenteExternoUrl) {
            linksContainer.innerHTML += `<a href="${client.agenteExternoUrl}" target="_blank" class="btn-optimizar" style="padding:6px 15px;font-size:0.85rem;background:rgba(56,189,248,0.2);border-color:var(--accent-blue);">chat externo</a>`;
          } else {
            linksContainer.innerHTML += `<span class="btn-optimizar" style="padding:6px 15px;font-size:0.85rem;background:rgba(255,255,255,0.05);border-color:transparent;opacity:0.5;cursor:not-allowed;" title="No configurado">chat externo</span>`;
          }
          if (client.crmUrl) {
            linksContainer.innerHTML += `<a href="${client.crmUrl}" target="_blank" class="btn-optimizar" style="padding:6px 15px;font-size:0.85rem;background:rgba(124,58,237,0.2);border-color:rgba(124,58,237,0.5);">abrir crm</a>`;
          } else {
            linksContainer.innerHTML += `<span class="btn-optimizar" style="padding:6px 15px;font-size:0.85rem;background:rgba(255,255,255,0.05);border-color:transparent;opacity:0.5;cursor:not-allowed;" title="No configurado">abrir crm</span>`;
          }
          if (client.specialButtons && client.specialButtons.length > 0) {
            client.specialButtons.forEach(btn => {
              if (btn.name && btn.url) {
                linksContainer.innerHTML += `<a href="${btn.url}" target="_blank" class="btn-optimizar" style="padding:6px 15px;font-size:0.85rem;background:rgba(244,114,182,0.2);border-color:var(--accent-pink);">${btn.name.toLowerCase()}</a>`;
              }
            });
          }
        }
      } else {
        console.error("Cliente no encontrado.");
        document.body.innerHTML = `<h2 style="color:white;text-align:center;margin-top:50px;">Error: Cliente no encontrado.</h2><div style="text-align:center;"><a href="admin.html" class="btn-optimizar">Volver al Panel</a></div>`;
        return;
      }
    } else {
      window.location.href = 'admin.html';
      return;
    }

  } else {
    // MODO USUARIO NORMAL
    console.log("Modo usuario detectado, buscando datos frescos...");

    // [FIX BUG 4+5] Siempre buscar datos frescos de la API (nunca solo de sesión)
    let freshUser = null;
    try {
      const users = typeof getAllUsers === 'function' ? await getAllUsers() : [];
      freshUser = users.find(u => String(u.id) === String(session.userId));
    } catch(e) {
      console.warn("Error al obtener usuarios frescos, usando sesión:", e);
    }

    if (freshUser) {
      CSV_URL = freshUser.csvUrl || '';
      WEBHOOK_URL = freshUser.webhookUrl || '';
      currentUserId = freshUser.id;
      currentUserName = freshUser.companyName || freshUser.name;

      // [FIX BUG 4] Inicializar siempre con datos frescos
      initActionSwitches(freshUser.actionButtons || []);
      initCustomCharts(freshUser.customCharts || []);

      const titleElement = document.getElementById('dashboard-client-title');
      if (titleElement) titleElement.textContent = `dashboard: ${currentUserName}`;

      const linksContainer = document.getElementById('dashboard-external-links');
      if (linksContainer) {
        linksContainer.innerHTML = '';
        if (freshUser.agenteExternoUrl) {
          linksContainer.innerHTML += `<a href="${freshUser.agenteExternoUrl}" target="_blank" class="btn-optimizar" style="padding:6px 15px;font-size:0.85rem;background:rgba(56,189,248,0.2);border-color:var(--accent-blue);">chat externo</a>`;
        }
        if (freshUser.crmUrl) {
          linksContainer.innerHTML += `<a href="${freshUser.crmUrl}" target="_blank" class="btn-optimizar" style="padding:6px 15px;font-size:0.85rem;background:rgba(124,58,237,0.2);border-color:rgba(124,58,237,0.5);">abrir crm</a>`;
        }
        if (freshUser.specialButtons && freshUser.specialButtons.length > 0) {
          freshUser.specialButtons.forEach(btn => {
            if (btn.name && btn.url) {
              linksContainer.innerHTML += `<a href="${btn.url}" target="_blank" class="btn-optimizar" style="padding:6px 15px;font-size:0.85rem;background:rgba(244,114,182,0.2);border-color:var(--accent-pink);">${btn.name.toLowerCase()}</a>`;
            }
          });
        }
      }
    } else {
      // Fallback a sesión — solo si la API falla completamente
      console.warn("Fallback a datos de sesión localStorage");
      CSV_URL = session.csvUrl || '';
      WEBHOOK_URL = session.webhookUrl || '';
      currentUserId = session.userId;
      currentUserName = session.companyName || session.name;

      initActionSwitches(session.actionButtons || []);
      initCustomCharts(session.customCharts || []);

      const titleElement = document.getElementById('dashboard-client-title');
      if (titleElement) titleElement.textContent = `dashboard: ${currentUserName}`;

      const linksContainer = document.getElementById('dashboard-external-links');
      if (linksContainer) {
        linksContainer.innerHTML = '';
        if (session.agenteExternoUrl) {
          linksContainer.innerHTML += `<a href="${session.agenteExternoUrl}" target="_blank" class="btn-optimizar" style="padding:6px 15px;font-size:0.85rem;background:rgba(56,189,248,0.2);border-color:var(--accent-blue);">chat externo</a>`;
        }
        if (session.crmUrl) {
          linksContainer.innerHTML += `<a href="${session.crmUrl}" target="_blank" class="btn-optimizar" style="padding:6px 15px;font-size:0.85rem;background:rgba(124,58,237,0.2);border-color:rgba(124,58,237,0.5);">abrir crm</a>`;
        }
        if (session.specialButtons && session.specialButtons.length > 0) {
          session.specialButtons.forEach(btn => {
            if (btn.name && btn.url) {
              linksContainer.innerHTML += `<a href="${btn.url}" target="_blank" class="btn-optimizar" style="padding:6px 15px;font-size:0.85rem;background:rgba(244,114,182,0.2);border-color:var(--accent-pink);">${btn.name.toLowerCase()}</a>`;
            }
          });
        }
      }
    }
  }
}

// [FIX BUG 2] Convierte la URL de Google Sheets a la URL del proxy interno
// para evitar el bloqueo CORS que ocurre al hacer fetch directo desde el navegador.
function getProxiedCsvUrl(url) {
  if (!url) return '';
  let cleanUrl = url.trim();

  // Normalizar el enlace de Google Sheets a formato CSV puro
  if (cleanUrl.includes('docs.google.com/spreadsheets')) {
    if (cleanUrl.includes('/pubhtml') || (cleanUrl.includes('/pub?') && !cleanUrl.includes('output=csv'))) {
      cleanUrl = cleanUrl.split('?')[0] + '?output=csv';
    } else if (cleanUrl.includes('/pubhtml')) {
      cleanUrl = cleanUrl.replace(/\/pubhtml.*$/, '/pub?output=csv');
    } else if (cleanUrl.includes('/edit') || cleanUrl.includes('/view')) {
      cleanUrl = cleanUrl.replace(/\/(edit|view).*$/, '/export?format=csv');
    }
  }

  // Usar el proxy del servidor para evitar CORS
  return `/api/proxy-csv?url=${encodeURIComponent(cleanUrl)}`;
}

async function fetchCSVData() {
  if (!CSV_URL) {
    console.warn("No hay URL de CSV configurada. Usando datos de prueba.");
    globalData = generateMockData();
    processAndRenderData(globalData);
  } else {
    // [FIX BUG 2] Usar proxy en vez de URL directa
    const proxiedUrl = getProxiedCsvUrl(CSV_URL);
    console.log("Cargando CSV via proxy:", proxiedUrl);

    Papa.parse(proxiedUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        console.log("CSV cargado exitosamente. Filas:", results.data.length);
        globalData = results.data.map(row => {
          const normalized = {};
          for (let key in row) {
            normalized[key.toLowerCase().trim()] = row[key];
          }
          return normalized;
        });
        processAndRenderData(globalData);
      },
      error: function(err) {
        console.error("Error al parsear el CSV:", err);
        if (totalMessagesEl) totalMessagesEl.textContent = "Error al cargar datos";
      }
    });
  }

  // Listeners de filtros de fecha
  if (startDateEl) {
    startDateEl.addEventListener('change', filterData);
    startDateEl.addEventListener('input', filterData);
  }
  if (endDateEl) {
    endDateEl.addEventListener('change', filterData);
    endDateEl.addEventListener('input', filterData);
  }
}

function processAndRenderData(dataToProcess) {
  const data = dataToProcess || globalData;
  const totalActividad = data ? data.length : 0;
  if (totalMessagesEl) totalMessagesEl.textContent = totalActividad.toLocaleString();

  if (!data || data.length === 0) {
    renderChart([], []);
    return;
  }

  function safeParseDate(rawDate) {
    if (!rawDate) return null;
    let str = String(rawDate).trim().split(' ')[0];
    str = str.split('T')[0];
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

  const countsByDate = {};

  // [FIX BUG 3] Filtro de sender robusto: si no existe la columna, mostrar todo
  const filteredData = data.filter(row => {
    const sender = (row.usuario || row.remitente || row.role || row.sender || '').toLowerCase().trim();
    const clientNameLower = currentUserName.toLowerCase();

    // Si ninguna columna de sender existe en esta fila, incluir el registro
    const hasSenderColumn = 'usuario' in row || 'remitente' in row || 'role' in row || 'sender' in row;
    if (!hasSenderColumn) return true;

    // Si la columna existe pero está vacía, excluir (no es un mensaje válido de agente)
    if (sender === '') return false;

    // Excluir mensajes del propio cliente/usuario genérico
    return sender !== clientNameLower && sender !== 'user' && sender !== 'cliente';
  });

  filteredData.forEach(row => {
    let raw = row.fecha || row.date || row.fecha || '';
    let d = safeParseDate(raw);
    let formattedDate = 'Desconocida';
    if (d) {
      formattedDate = d.toISOString().split('T')[0];
    }
    if (!countsByDate[formattedDate]) countsByDate[formattedDate] = 0;
    countsByDate[formattedDate]++;
  });

  const sortedDates = Object.keys(countsByDate).sort((a, b) => {
    if (a === 'Desconocida') return -1;
    if (b === 'Desconocida') return 1;
    return new Date(a) - new Date(b);
  });

  const chartLabels = sortedDates.map(date => {
    if (date === 'Desconocida') return date;
    const [y, m, d] = date.split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
    return date;
  });
  const chartData = sortedDates.map(date => countsByDate[date]);

  renderChart(chartLabels, chartData);

  if (sortedDates.length > 0 && startDateEl && !startDateEl.value) {
    try {
      let start = new Date(sortedDates[0]);
      let end = new Date(sortedDates[sortedDates.length - 1]);
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() + 1);
      startDateEl.value = start.toISOString().split('T')[0];
      endDateEl.value = end.toISOString().split('T')[0];
    } catch(e) {
      console.warn("Error autocompletando fechas:", e);
    }
  }
}

function filterData() {
  if (!startDateEl || !endDateEl) return;
  let start = startDateEl.value ? new Date(startDateEl.value + 'T00:00:00') : null;
  let end = endDateEl.value ? new Date(endDateEl.value + 'T23:59:59') : null;

  const filteredData = globalData.filter(row => {
    let rawDate = row.fecha || row.date || row.Fecha || row.Date;
    if (!rawDate) return false;
    let str = String(rawDate).trim().split(' ')[0].split('T')[0];
    const partsSlash = str.split('/');
    const partsDash = str.split('-');
    let rowDate;
    if (partsSlash.length === 3) {
      rowDate = new Date(`${partsSlash[2]}-${partsSlash[1]}-${partsSlash[0]}T12:00:00`);
    } else if (partsDash.length === 3 && partsDash[0].length === 2) {
      rowDate = new Date(`${partsDash[2]}-${partsDash[1]}-${partsDash[0]}T12:00:00`);
    } else {
      rowDate = new Date(str + 'T12:00:00');
      if (isNaN(rowDate)) rowDate = new Date(str);
    }
    if (isNaN(rowDate) || !rowDate) return false;
    if (start && rowDate < start) return false;
    if (end && rowDate > end) return false;
    return true;
  });

  processAndRenderData(filteredData);
}

function renderChart(labels, data) {
  const canvas = document.getElementById('responsesChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (chartInstance) chartInstance.destroy();

  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(56, 189, 248, 0.5)');
  gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

  Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
  Chart.defaults.font.family = "'Poppins', sans-serif";

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Respuestas de IA',
        data: data,
        borderColor: '#38bdf8',
        backgroundColor: gradient,
        borderWidth: 3,
        pointBackgroundColor: '#f472b6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.1)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255,255,255,0.3)',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: function(context) { return `${context.parsed.y} respuestas`; }
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false } },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false, tickLength: 0 },
          border: { dash: [5, 5] }
        }
      }
    }
  });
}

function generateMockData() {
  const data = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 30);
  for (let i = 0; i < 150; i++) {
    const randomDays = Math.floor(Math.random() * 30);
    const date = new Date(baseDate);
    date.setDate(date.getDate() + randomDays);
    data.push({
      fecha: date.toISOString().split('T')[0] + ' 10:00:00',
      cliente: `Cliente ${i}`,
      respuesta: Math.random() > 0.2 ? 'Respuesta generada por IA' : ''
    });
  }
  return data;
}

// ==========================================================================
// Lógica de Chat (Agente Interno)
// ==========================================================================
function appendMessage(sender, text, isTyping = false) {
  if (!chatHistory) return;
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message');
  if (sender === 'user') msgDiv.classList.add('user-msg');
  else if (sender === 'bot') msgDiv.classList.add('bot-msg');

  if (isTyping) {
    msgDiv.classList.add('typing-indicator');
    msgDiv.id = 'typing-indicator';
    msgDiv.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
  } else {
    const p = document.createElement('p');
    p.textContent = text;
    msgDiv.appendChild(p);
  }

  chatHistory.appendChild(msgDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}

function setupEventListeners() {
  if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = chatInput.value.trim();
      if (!message) return;

      if (!WEBHOOK_URL) {
        appendMessage('bot', "Error: El administrador no ha configurado un Webhook para esta cuenta.");
        return;
      }

      appendMessage('user', message);
      chatInput.value = '';
      appendMessage('bot', '', true);

      try {
        const response = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*'
          },
          body: JSON.stringify({ sessionId: SESSION_ID, message: message })
        });

        removeTypingIndicator();

        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await response.json();
            if (Array.isArray(data)) {
              data.forEach(item => {
                const botReply = item.response || item.text || item.message || item.output || item.mensaje || JSON.stringify(item);
                appendMessage('bot', botReply);
              });
            } else {
              const botReply = data.response || data.text || data.message || data.output || data.mensaje || JSON.stringify(data);
              appendMessage('bot', botReply);
            }
          } else {
            const textData = await response.text();
            if (textData) {
              textData.split('\n').filter(msg => msg.trim() !== '').forEach(msg => appendMessage('bot', msg));
            } else {
              appendMessage('bot', "Mensaje recibido, pero respuesta vacía.");
            }
          }
        } else {
          console.error('Error del webhook:', response.status);
          appendMessage('bot', "Error: No pude conectar con el servidor (Status " + response.status + ")");
        }
      } catch (error) {
        console.error('Error de red:', error);
        removeTypingIndicator();
        appendMessage('bot', "Error de red: Verificá la conexión con n8n (revisa CORS del webhook).");
      }
    });
  }
}

// ==========================================================================
// [FIX BUG 1] Inicialización correcta — compatible con auth.js que corre
// requireAuth() de forma síncrona ANTES de que el DOM termine de parsear.
// Usamos readyState para ejecutar initApp() siempre, sin importar si el
// evento DOMContentLoaded ya ocurrió o no.
// ==========================================================================
function initApp() {
  if (
    document.getElementById('responsesChart') ||
    document.getElementById('chat-history') ||
    document.getElementById('total-messages')
  ) {
    initializeDashboardConfig().then(() => {
      fetchCSVData();
      setupEventListeners();
    });
  }
}

if (document.readyState === 'loading') {
  // DOM todavía cargando — esperar el evento
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // DOM ya cargó (auth.js lo bloqueó) — ejecutar directo
  initApp();
}

// ==========================================================================
// Lógica de Action Buttons (Switches de Flujo n8n)
// ==========================================================================
async function initActionSwitches(actionButtons) {
  const panel = document.getElementById('action-controls-panel');
  const container = document.getElementById('action-switches-container');

  if (!panel || !container) return;

  // [FIX BUG 4] Si no hay botones, ocultar el panel y salir
  if (!actionButtons || actionButtons.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  container.innerHTML = '';

  for (const btn of actionButtons) {
    if (!btn.name || !btn.webhookUrl) continue;

    const switchId = 'switch-' + btn.name.replace(/\s+/g, '-').toLowerCase();
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;align-items:center;gap:14px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 18px;min-width:220px;';
    wrapper.innerHTML = `
      <div style="flex:1;">
        <p style="margin:0;font-size:0.85rem;font-weight:600;color:rgba(255,255,255,0.9);text-transform:lowercase;">${btn.name.toLowerCase()}</p>
        <p id="${switchId}-status" style="margin:3px 0 0 0;font-size:0.72rem;color:#aaa;">consultando...</p>
      </div>
      <button id="${switchId}-btn"
        onclick="toggleActionSwitch('${switchId}', '${btn.webhookUrl}')"
        style="position:relative;width:50px;height:26px;border-radius:13px;border:1px solid rgba(255,255,255,0.1);cursor:pointer;background:rgba(255,255,255,0.1);transition:background 0.3s ease;outline:none;flex-shrink:0;">
        <span id="${switchId}-knob" style="position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#aaa;transition:transform 0.3s ease,background 0.3s ease;"></span>
      </button>
    `;
    container.appendChild(wrapper);
    fetchSwitchState(switchId, btn.webhookUrl);
  }
}

async function fetchSwitchState(switchId, webhookUrl) {
  try {
    const res = await fetch(webhookUrl, { method: 'GET' });
    if (!res.ok) throw new Error('Error del servidor');
    const data = await res.json();
    const item = Array.isArray(data) ? data[0] : data;
    const isOn = item.estado_nuevo
      ? item.estado_nuevo === 'ON'
      : (item.emailEnabled ?? item.enabled ?? item.active ?? false);
    updateSwitchUI(switchId, isOn, item.mensaje);
  } catch (err) {
    const statusEl = document.getElementById(`${switchId}-status`);
    if (statusEl) statusEl.textContent = 'sin conexión';
  }
}

async function toggleActionSwitch(switchId, webhookUrl) {
  const btnEl = document.getElementById(`${switchId}-btn`);
  const statusEl = document.getElementById(`${switchId}-status`);
  if (!btnEl) return;

  btnEl.disabled = true;
  if (statusEl) { statusEl.textContent = 'cambiando...'; statusEl.style.color = '#aaa'; }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle' })
    });
    if (!res.ok) throw new Error('Error del servidor');
    const data = await res.json();
    const item = Array.isArray(data) ? data[0] : data;
    const isOn = item.estado_nuevo
      ? item.estado_nuevo === 'ON'
      : (item.emailEnabled ?? item.enabled ?? item.active ?? false);
    updateSwitchUI(switchId, isOn, item.mensaje);
  } catch (err) {
    if (statusEl) { statusEl.textContent = 'error al cambiar'; statusEl.style.color = '#f87171'; }
  } finally {
    btnEl.disabled = false;
  }
}

function updateSwitchUI(switchId, isOn, mensaje) {
  const btnEl = document.getElementById(`${switchId}-btn`);
  const knobEl = document.getElementById(`${switchId}-knob`);
  const statusEl = document.getElementById(`${switchId}-status`);
  if (!btnEl || !knobEl) return;

  const wrapper = btnEl.parentElement;

  if (isOn) {
    btnEl.style.background = 'rgba(52,211,153,0.35)';
    btnEl.style.borderColor = '#34d399';
    knobEl.style.transform = 'translateX(24px)';
    knobEl.style.background = '#34d399';
    if (wrapper) wrapper.style.boxShadow = '0 0 12px 2px rgba(52,211,153,0.45)';
    if (statusEl) { statusEl.textContent = mensaje || 'activo'; statusEl.style.color = '#34d399'; }
  } else {
    btnEl.style.background = 'rgba(248,113,113,0.2)';
    btnEl.style.borderColor = '#f87171';
    knobEl.style.transform = 'translateX(0)';
    knobEl.style.background = '#f87171';
    if (wrapper) wrapper.style.boxShadow = '0 0 12px 2px rgba(248,113,113,0.35)';
    if (statusEl) { statusEl.textContent = mensaje || 'desactivado'; statusEl.style.color = '#f87171'; }
  }
}

// ==========================================================================
// Gráficos Personalizados del Cliente — Renderizado
// ==========================================================================

// [FIX BUG 2] Usar el mismo proxy para los CSVs de gráficos personalizados
function getDirectCsvUrlCustom(url) {
  if (!url) return '';
  let cleanUrl = url.trim();
  if (cleanUrl.includes('docs.google.com/spreadsheets')) {
    if (cleanUrl.includes('/pubhtml')) cleanUrl = cleanUrl.replace(/\/pubhtml.*$/, '/pub?output=csv');
    else if (cleanUrl.includes('/edit') || cleanUrl.includes('/view')) cleanUrl = cleanUrl.replace(/\/(edit|view).*$/, '/export?format=csv');
  }
  // Usar proxy para evitar CORS
  return `/api/proxy-csv?url=${encodeURIComponent(cleanUrl)}`;
}

function initCustomCharts(customCharts) {
  const section = document.getElementById('custom-charts-section');
  const grid = document.getElementById('custom-charts-grid');

  if (!section || !grid) return;

  // [FIX BUG 4] Ocultar sección si no hay gráficos
  if (!customCharts || customCharts.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  grid.innerHTML = '';

  customCharts.forEach(function(cfg, idx) {
    if (!cfg.name || !cfg.csvUrl) return;

    var canvasId = 'custom-chart-canvas-' + idx;
    var card = document.createElement('div');
    card.className = 'glass-container';
    card.style.cssText = 'padding: 18px;';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h4 style="margin:0;font-size:0.88rem;font-weight:600;color:rgba(255,255,255,0.95);text-transform:lowercase;">${cfg.name.toLowerCase()}</h4>
        <span id="badge-${idx}" style="font-size:0.7rem;background:rgba(167,139,250,0.15);color:#a78bfa;padding:2px 8px;border-radius:20px;border:1px solid rgba(167,139,250,0.3);">cargando...</span>
      </div>
      <div style="position:relative;height:220px;width:100%;">
        <canvas id="${canvasId}"></canvas>
      </div>
      <p id="err-${idx}" style="font-size:0.75rem;color:#f87171;margin:8px 0 0 0;display:none;"></p>
    `;
    grid.appendChild(card);
    fetchAndRenderCustomChart(cfg, canvasId, idx);
  });
}

function fetchAndRenderCustomChart(cfg, canvasId, idx) {
  var url = getDirectCsvUrlCustom(cfg.csvUrl);
  var badgeEl = document.getElementById('badge-' + idx);

  Papa.parse(url, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      try {
        var rows = results.data.map(function(row) {
          var nr = {};
          for (var k in row) nr[k.toLowerCase().trim()] = row[k];
          return nr;
        });

        var dateKey = (cfg.dateColumn || 'fecha').toLowerCase().trim();
        var valKey = (cfg.valueColumn || 'COUNT').toLowerCase().trim();
        var agg = cfg.aggregation || 'count';
        var isCount = valKey === 'count';

        var grouped = {};
        rows.forEach(function(row) {
          var raw = row[dateKey];
          if (!raw) return;
          var d = safeParseCustomDate(raw);
          if (!d) return;
          var key = d.toISOString().split('T')[0];
          if (!grouped[key]) grouped[key] = { sum: 0, count: 0 };
          grouped[key].count++;
          if (!isCount) {
            var num = parseFloat(String(row[valKey] || '0').replace(',', '.'));
            if (!isNaN(num)) grouped[key].sum += num;
          }
        });

        var sortedDates = Object.keys(grouped).sort(function(a, b) { return new Date(a) - new Date(b); });

        if (sortedDates.length === 0) {
          showCustomChartError(idx, 'No se encontraron datos con la columna "' + cfg.dateColumn + '"');
          return;
        }

        var labels = sortedDates.map(function(d) {
          var p = d.split('-');
          return p[2] + '/' + p[1] + '/' + p[0];
        });

        var data = sortedDates.map(function(k) {
          if (agg === 'sum') return grouped[k].sum;
          if (agg === 'avg') return grouped[k].count > 0 ? +(grouped[k].sum / grouped[k].count).toFixed(2) : 0;
          return grouped[k].count;
        });

        var total = data.reduce(function(a, b) { return a + b; }, 0);
        var display = agg === 'count' ? total + ' total' : total.toFixed(2) + ' ' + (cfg.metricLabel || '');
        if (badgeEl) badgeEl.textContent = display;

        renderCustomChart(canvasId, labels, data, cfg);
      } catch(e) {
        showCustomChartError(idx, 'Error procesando datos: ' + e.message);
      }
    },
    error: function() {
      showCustomChartError(idx, 'No se pudo cargar el CSV. Verificá que sea público y que la URL esté bien configurada.');
    }
  });
}

function safeParseCustomDate(raw) {
  if (!raw) return null;
  var str = String(raw).trim().split(' ')[0].split('T')[0];
  var ps = str.split('/');
  var pd = str.split('-');
  var d;
  if (ps.length === 3) d = new Date(ps[2] + '-' + ps[1] + '-' + ps[0] + 'T12:00:00');
  else if (pd.length === 3 && pd[0].length === 2) d = new Date(pd[2] + '-' + pd[1] + '-' + pd[0] + 'T12:00:00');
  else {
    d = new Date(str + 'T12:00:00');
    if (isNaN(d)) d = new Date(str);
  }
  return isNaN(d) ? null : d;
}

function showCustomChartError(idx, msg) {
  var badgeEl = document.getElementById('badge-' + idx);
  var errEl = document.getElementById('err-' + idx);
  if (badgeEl) {
    badgeEl.textContent = 'error';
    badgeEl.style.color = '#f87171';
    badgeEl.style.borderColor = 'rgba(248,113,113,0.3)';
    badgeEl.style.background = 'rgba(248,113,113,0.1)';
  }
  if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
}

function hexToRgba(hex, alpha) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function renderCustomChart(canvasId, labels, data, cfg) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var color = cfg.color || '#a78bfa';
  var isBar = cfg.chartType === 'bar';

  var gradBg;
  if (!isBar) {
    gradBg = ctx.createLinearGradient(0, 0, 0, 220);
    var colorStart = color.startsWith('#') ? hexToRgba(color, 0.35) : color.replace(')', ', 0.35)').replace('rgb', 'rgba');
    var colorEnd = color.startsWith('#') ? hexToRgba(color, 0.0) : color.replace(')', ', 0.0)').replace('rgb', 'rgba');
    gradBg.addColorStop(0, colorStart);
    gradBg.addColorStop(1, colorEnd);
  } else {
    gradBg = color;
  }

  Chart.defaults.color = 'rgba(255,255,255,0.6)';
  Chart.defaults.font.family = "'Poppins', sans-serif";

  new Chart(ctx, {
    type: cfg.chartType || 'line',
    data: {
      labels: labels,
      datasets: [{
        label: cfg.metricLabel || cfg.name,
        data: data,
        borderColor: color,
        backgroundColor: isBar ? color + '88' : gradBg,
        borderWidth: isBar ? 0 : 2.5,
        pointBackgroundColor: color,
        pointRadius: isBar ? 0 : 3,
        fill: !isBar,
        tension: 0.4,
        borderRadius: isBar ? 4 : 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: color,
          borderWidth: 1,
          padding: 8,
          displayColors: false,
          callbacks: {
            label: function(ctx) { return ctx.parsed.y + ' ' + (cfg.metricLabel || ''); }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { maxTicksLimit: 8, font: { size: 10 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { font: { size: 10 } }
        }
      }
    }
  });
}
