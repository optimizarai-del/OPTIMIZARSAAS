// admin.js - Lógica específica para el panel unificado de clientes y analíticas
document.addEventListener('DOMContentLoaded', () => {
    // Render de la navegación superior
    renderAuthenticatedNav('admin');

    // Inicializar Vistas
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
    
    // Limpiar botones especiales
    document.getElementById('special-buttons-container').innerHTML = '';
    
    // Mostrar u ocultar campos específicos de clientes
    const clientFields = document.getElementById('client-specific-fields');
    if (roleType === 'admin') {
        clientFields.style.display = 'none';
        // Hacerlos no requeridos si están ocultos
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

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('user-id').value;
    const roleType = document.getElementById('user-role-hf').value;
    const name = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const password = document.getElementById('user-password').value;
    
    if (id) {
        // Modo Edición
        const updates = { name, email };
        if (password && password !== 'Optimizar123') {
            updates.password = password;
             // Si el admin le cambia la contraseña a un usuario, no le forzamos a cambiarla
            updates.requiresPasswordChange = false;
        }

        if (roleType === 'user') {
            updates.companyName = document.getElementById('user-company').value;
            updates.csvUrl = document.getElementById('user-csv').value;
            updates.webhookUrl = document.getElementById('user-webhook').value;
            updates.crmUrl = document.getElementById('user-crm').value;
            updates.agenteExternoUrl = document.getElementById('user-agente-externo').value;
            
            // Recopilar botones especiales
            const specialBtns = [];
            const container = document.getElementById('special-buttons-container');
            const blocks = container.querySelectorAll('.special-btn-block');
            blocks.forEach(b => {
                const bName = b.querySelector('.sp-name').value;
                const bUrl = b.querySelector('.sp-url').value;
                if(bName && bUrl) specialBtns.push({name: bName, url: bUrl});
            });
            updates.specialButtons = specialBtns;
        }

        updateUser(id, updates);
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
            extraData.requiresPasswordChange = true; // Flujo obligado de seguridad
            
            // Recopilar botones especiales
            const specialBtns = [];
            const container = document.getElementById('special-buttons-container');
            const blocks = container.querySelectorAll('.special-btn-block');
            blocks.forEach(b => {
                const bName = b.querySelector('.sp-name').value;
                const bUrl = b.querySelector('.sp-url').value;
                if(bName && bUrl) specialBtns.push({name: bName, url: bUrl});
            });
            extraData.specialButtons = specialBtns;
        }

        const res = registerUser(name, email, password, roleType, allowedPages, extraData);
        if (!res.success) {
            alert(res.message);
            return;
        }

        // Si se crea exitosamente, disparamos el envío de correo de bienvenida
        sendWelcomeEmail({
            name: name,
            email: email,
            password: password,
            role: roleType
        });
    }
    
    closeUserModal();
    renderClientsTable();
    renderAdminsTable();
    if(roleType === 'user') loadGlobalMetrics();
});

// ==========================================================================
// Automatización de Correos
// ==========================================================================
function sendWelcomeEmail(userData) {
    // Webhook de n8n proporcionado por el usuario
    const N8N_EMAIL_WEBHOOK = 'https://n8n.optimizar-ia.com/webhook/email-luncher'; 

    const subject = encodeURIComponent("Tus accesos a Optimizar AI");
    const body = encodeURIComponent(
`Hola ${userData.name},

Tu cuenta en la plataforma Optimizar AI ha sido creada exitosamente.

Link de acceso: https://optimizar-ia.com
Tu correo: ${userData.email}
Tu contraseña temporal: ${userData.password}

Por seguridad, el sistema te pedirá que cambies esta contraseña la primera vez que inicies sesión.

Saludos,
El equipo de Optimizar AI`);

    // Si hay un webhook configurado, enviar por POST (oculto al usuario)
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
        // Redundancia: Si no hay webhook, abrir el cliente de correo del Admin (funciona 100% sin configurar nada)
        window.open(`mailto:${userData.email}?subject=${subject}&body=${body}`, '_blank');
    }
}

// ==========================================================================
// Edición y Eliminación
// ==========================================================================
function editUserRecord(userId) {
    const users = getAllUsers();
    const user = users.find(u => u.id === userId);
    if(!user) return;

    openCreateUserModal(user.role);
    
    document.getElementById('modal-title').textContent = user.role === 'admin' ? 'editar administrador' : 'editar cliente';
    document.getElementById('user-id').value = user.id;
    document.getElementById('user-name').value = user.name;
    document.getElementById('user-email').value = user.email;
    document.getElementById('user-password').value = ''; // No mostrar la real, dejar vacío a menos que se quiera cambiar
    document.getElementById('user-password').placeholder = 'Dejar vacío para no cambiar';

    if (user.role === 'user') {
        document.getElementById('user-company').value = user.companyName || '';
        document.getElementById('user-csv').value = user.csvUrl || '';
        document.getElementById('user-webhook').value = user.webhookUrl || '';
        document.getElementById('user-crm').value = user.crmUrl || '';
        document.getElementById('user-agente-externo').value = user.agenteExternoUrl || '';
        
        // Renderizar botones especiales existentes
        const container = document.getElementById('special-buttons-container');
        container.innerHTML = '';
        if(user.specialButtons && user.specialButtons.length > 0) {
            user.specialButtons.forEach(btn => addSpecialButtonField(btn.name, btn.url));
        }
    }
}

// ==========================================================================
// Botones Especiales Lógica
// ==========================================================================
const btnAddSpecial = document.getElementById('btn-add-special');
if(btnAddSpecial) {
    btnAddSpecial.addEventListener('click', () => {
        const container = document.getElementById('special-buttons-container');
        if (container.children.length < 4) {
            addSpecialButtonField('', '');
        } else {
            alert('Solo se permiten hasta 4 botones especiales por cliente.');
        }
    });
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
        <button type="button" onclick="this.parentElement.remove()" style="position: absolute; top: 5px; right: 5px; background: none; border: none; color: #f87171; cursor: pointer; font-size: 1.2rem; line-height: 1;">&times;</button>
        <div style="margin-bottom: 5px;">
            <input type="text" class="glass-input sp-name" placeholder="Nombre del botón (ej. Reporte XLS)" value="${nameVal}" required style="padding: 5px 10px; font-size: 0.85rem;">
        </div>
        <div>
            <input type="url" class="glass-input sp-url" placeholder="https://..." value="${urlVal}" required style="padding: 5px 10px; font-size: 0.85rem;">
        </div>
    `;
    container.appendChild(div);
}

function removeUserRecord(userId) {
    // Protección simple 
    if(confirm("¿Estás seguro que deseas eliminar este registro permanentemente?")) {
        const res = deleteUser(userId);
        if (res.success) {
            renderClientsTable();
            renderAdminsTable();
            loadGlobalMetrics(); // Refrescar gráficos
        } else {
            alert(res.message);
        }
    }
}

function viewClientDashboard(clientId) {
    // Redirigir al dashboard pasandole el ID para que la lógica de script.js lo cargue
    window.location.href = `dashboard.html?clientId=${clientId}`;
}

// ==========================================================================
// Tablas (Admins & Clientes)
// ==========================================================================
function renderAdminsTable() {
    const admins = getAllUsers().filter(u => u.role === 'admin');
    const tbody = document.getElementById('admins-table-body');
    tbody.innerHTML = '';
    
    admins.forEach(admin => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${admin.name}</td>
            <td>${admin.email}</td>
            <td><span style="color: var(--accent-pink); font-weight: 600;">${admin.role}</span></td>
            <td>
                <button onclick="editUserRecord('${admin.id}')" class="btn-optimizar" style="padding: 5px 15px; font-size: 0.8rem;">editar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderClientsTable() {
    const clients = getAllUsers().filter(u => u.role === 'user');
    const tbody = document.getElementById('clients-table-body');
    tbody.innerHTML = '';
    
    clients.forEach(client => {
        const tr = document.createElement('tr');
        tr.className = 'clickable-row';

        // Botón CRM Seguro
        let crmBtn = `<span style="opacity: 0.4; font-size: 0.8rem;">Sin CRM</span>`;
        if (client.crmUrl) {
           crmBtn = `<a href="${client.crmUrl}" target="_blank" class="btn-crm" onclick="event.stopPropagation()">Abrir CRM</a>`;
        }

        const displayName = client.companyName ? `${client.companyName} (${client.name})` : client.name;
        
        tr.innerHTML = `
            <td onclick="viewClientDashboard('${client.id}')" style="font-weight: 600; color: var(--accent-blue);">${displayName}</td>
            <td onclick="viewClientDashboard('${client.id}')">${client.email}</td>
            <td>${crmBtn}</td>
            <td>
                <button onclick="editUserRecord('${client.id}')" class="btn-optimizar" style="padding: 5px 15px; font-size: 0.8rem;">editar</button>
                <button onclick="removeUserRecord('${client.id}')" class="btn-optimizar" style="padding: 5px 15px; font-size: 0.8rem; background: rgba(244, 114, 182, 0.1); border-color: var(--accent-pink); margin-left: 5px;">borrar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================================================
// Gráfico Global Multi-Línea y Agregación de Datos
// ==========================================================================

let globalAdminChart = null;
let allClientsDataCache = {}; // Cache de { clientId: { parsedCsvData[], totalMessages, totalResponses } }
const chartColors = [
    '#38bdf8', '#f472b6', '#a855f7', '#34d399', '#fbbf24', 
    '#fb7185', '#60a5fa', '#818cf8', '#c084fc', '#f43f5e'
]; // Paleta vibrante para clientes

async function loadGlobalMetrics() {
    const clients = getAllUsers().filter(u => u.role === 'user');
    const trigger = document.getElementById('admin-client-multi-trigger');
    const dropdown = document.getElementById('admin-client-multi-dropdown');
    
    // Repoblar Dropdown
    dropdown.innerHTML = `
        <label style="padding: 8px 15px; cursor: pointer; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <input type="checkbox" id="selectAllClients" checked>
            <span style="font-weight: 600;">Todos los clientes</span>
        </label>
    `;

    clients.forEach(c => {
        dropdown.innerHTML += `
            <label style="padding: 8px 15px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <input type="checkbox" class="client-checkbox" value="${c.id}" checked>
                <span>${c.companyName || c.name}</span>
            </label>
        `;
    });

    // Lógica UI de Select Múltiple
    trigger.onclick = () => {
        dropdown.style.display = dropdown.style.display === 'flex' ? 'none' : 'flex';
    };
    
    // Cerrar si se clickea afuera
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

    checkboxes.forEach(cb => {
        cb.addEventListener('change', updateSelection);
    });
    
    // Parsear todos los CSV secuencialmente (o desde caché para optimizar recargas rápidas)
    // Para simplificar y evitar colapsos, solo pediremos los que tengan URL configurada

    function getDirectCsvUrl(url) {
        if (!url) return '';
        if (url.includes('docs.google.com/spreadsheets')) {
            if (url.includes('/pubhtml')) {
                return url.replace(/\/pubhtml.*$/, '/pub?output=csv');
            } else if (url.includes('/edit') || url.includes('/view')) {
                return url.replace(/\/(edit|view).*$/, '/export?format=csv');
            }
        }
        return url;
    }

    const fetchPromises = clients.map(client => {
        return new Promise(resolve => {
            if (!client.csvUrl) {
                resolve({ clientId: client.id, data: [], name: client.companyName || client.name });
                return;
            }

            Papa.parse(getDirectCsvUrl(client.csvUrl), {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    // Normalizar headers
                    const normData = results.data.map(row => {
                        const nr = {};
                        for (let k in row) nr[k.toLowerCase().trim()] = row[k];
                        return nr;
                    });
                    resolve({ clientId: client.id, data: normData, name: client.companyName || client.name });
                },
                error: function(err) {
                    console.warn(`Error cargando CSV de ${client.name}:`, err);
                    resolve({ clientId: client.id, data: [], name: client.companyName || client.name });
                }
            });
        });
    });

    const parsedResults = await Promise.all(fetchPromises);
    
    // Reiniciar cache global
    allClientsDataCache = {};
    parsedResults.forEach(res => {
        allClientsDataCache[res.clientId] = {
            rawData: res.data,
            name: res.name
        };
    });

    // Enganchar listeners de fecha
    const stEl = document.getElementById('start-date-global');
    const enEl = document.getElementById('end-date-global');
    
    if(stEl) stEl.addEventListener('input', triggerGlobalChartUpdate);
    if(enEl) enEl.addEventListener('input', triggerGlobalChartUpdate);

    // Primer render con todo seleccionado por defecto (sin filtro de fechas)
    triggerGlobalChartUpdate();
}

// Wrapper para disparar actualización reuniendo los filtros actuales
function triggerGlobalChartUpdate() {
    const checkboxes = document.querySelectorAll('.client-checkbox');
    const selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    
    const startVal = document.getElementById('start-date-global').value;
    const endVal = document.getElementById('end-date-global').value;
    
    processGlobalChartData(allClientsDataCache, selectedIds, startVal, endVal);
}

// Helper robusto para fechas (mismo que script.js)
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
    
    // 1. Extraer todas las fechas únicas de los clientes seleccionados para normalizar el eje X
    let allDatesSet = new Set();
    const clientStats = {}; // { clientId: { dateStr: count } }
    
    selectedClientIds.forEach(cId => {
        clientStats[cId] = {};
        if(!cache[cId]) return;
        
        const cData = cache[cId].rawData;
        
        cData.forEach(row => {
            let raw = row.fecha || row.Fecha;
            let d = safeParseDate(raw);
            if (!d) return;

            // Filtro de Fechas
            if (start && d < start) return;
            if (end && d > end) return;

            // Suma al total global solo si pasó el filtro
            grmessages++;

            let formattedDate = d.toISOString().split('T')[0];
            allDatesSet.add(formattedDate);
            
            if (!clientStats[cId][formattedDate]) {
                clientStats[cId][formattedDate] = 0;
            }
            
            clientStats[cId][formattedDate]++;
        });
    });

    // Actualizar Cajas Globales Computadas dinámicamente
    document.getElementById('global-total-msg').textContent = grmessages.toLocaleString();

    // Ordenar todas las fechas master
    const masterDates = Array.from(allDatesSet).sort((a, b) => new Date(a) - new Date(b));
    
    // Labels del grafico (DD/MM/YYYY)
    const labels = masterDates.map(date => {
        const [y, m, d] = date.split('-');
        if (y && m && d) return `${d}/${m}/${y}`;
        return date;
    });

    // Construir datasets para Chart.js
    const datasets = [];
    let colorIndex = 0;
    
    const legendContainer = document.getElementById('chart-legend');
    legendContainer.innerHTML = '';

    selectedClientIds.forEach((cId, idx) => {
        if (!cache[cId]) return;
        const clientName = cache[cId].name;
        const color = chartColors[colorIndex % chartColors.length];
        colorIndex++;

        // Alinear datos con las Master Dates (llenar con 0 donde no hay actividad)
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

        // Crear Item de Leyenda custom
        const legendHtml = `
            <div class="legend-item" id="legend-${idx}" onclick="toggleDataset(${idx}, this)">
                <div class="legend-color" style="background: ${color};"></div>
                <span>${clientName}</span>
            </div>
        `;
        legendContainer.innerHTML += legendHtml;
    });

    // Auto-completar fechas si hay datos pero los inputs están vacíos
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

// Configurar y renderizar la instancia de Chart.js
function renderAdminChart(labels, datasets) {
    const canvas = document.getElementById('globalChart');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');

    if (globalAdminChart) {
        globalAdminChart.destroy();
    }

    Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
    Chart.defaults.font.family = "'Poppins', sans-serif";

    globalAdminChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }, // Usamos nuestra leyenda HTML custom
                tooltip: {
                    mode: 'index', // Muestra todas las lineas en ese punto
                    intersect: false,
                    backgroundColor: 'rgba(30,30,45, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false } },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Logica para ocultar/mostrar lineas individualmente via leyenda custom
function toggleDataset(index, element) {
    const meta = globalAdminChart.getDatasetMeta(index);
    meta.hidden = meta.hidden === null ? !globalAdminChart.data.datasets[index].hidden : null;
    globalAdminChart.update();
    element.classList.toggle('hidden');
}
