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
let globalData = []; // Almacenará los datos parseados del CSV

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
            const users = typeof getAllUsers === 'function' ? getAllUsers() : [];
            const client = users.find(u => u.id === inspectClientId);
            
            if (client) {
                CSV_URL = client.csvUrl || '';
                WEBHOOK_URL = client.webhookUrl || '';
                currentUserId = client.id;
                currentUserName = client.companyName || client.name;
                
                // Cambiar titulo
                const titleElement = document.getElementById('dashboard-client-title');
                if (titleElement) {
                    titleElement.textContent = `dashboard: ${currentUserName}`;
                }
                
                // Mostrar botones de enlaces externos
                const linksContainer = document.getElementById('dashboard-external-links');
                if (linksContainer) {
                    linksContainer.innerHTML = '';
                    
                    // Botón Agente Externo (Fijo)
                    if (client.agenteExternoUrl) {
                        linksContainer.innerHTML += `<a href="${client.agenteExternoUrl}" target="_blank" class="btn-optimizar" style="padding: 6px 15px; font-size: 0.85rem; background: rgba(56, 189, 248, 0.2); border-color: var(--accent-blue);">chat externo</a>`;
                    } else {
                        linksContainer.innerHTML += `<span class="btn-optimizar" style="padding: 6px 15px; font-size: 0.85rem; background: rgba(255, 255, 255, 0.05); border-color: transparent; opacity: 0.5; cursor: not-allowed;" title="No configurado">chat externo</span>`;
                    }
                    
                    // Botón CRM (Fijo)
                    if (client.crmUrl) {
                        linksContainer.innerHTML += `<a href="${client.crmUrl}" target="_blank" class="btn-optimizar" style="padding: 6px 15px; font-size: 0.85rem; background: rgba(124, 58, 237, 0.2); border-color: rgba(124, 58, 237, 0.5);">abrir crm</a>`;
                    } else {
                        linksContainer.innerHTML += `<span class="btn-optimizar" style="padding: 6px 15px; font-size: 0.85rem; background: rgba(255, 255, 255, 0.05); border-color: transparent; opacity: 0.5; cursor: not-allowed;" title="No configurado">abrir crm</span>`;
                    }
                    
                    // Botones Especiales (Dinámicos)
                    if (client.specialButtons && client.specialButtons.length > 0) {
                        client.specialButtons.forEach(btn => {
                            if (btn.name && btn.url) {
                                linksContainer.innerHTML += `<a href="${btn.url}" target="_blank" class="btn-optimizar" style="padding: 6px 15px; font-size: 0.85rem; background: rgba(244, 114, 182, 0.2); border-color: var(--accent-pink);">${btn.name.toLowerCase()}</a>`;
                            }
                        });
                    }
                }
            } else {
                console.error("Cliente no encontrado.");
                document.body.innerHTML = `<h2 style="color:white; text-align:center; margin-top:50px;">Error: Cliente no encontrado.</h2><div style="text-align:center;"><a href="admin.html" class="btn-optimizar">Volver al Panel</a></div>`;
                return;
            }
        } else {
            // Admin intentando acceder al dashboard sin un cliente especificado
            window.location.href = 'admin.html';
            return;
        }
    } else {
        // MODO USUARIO NORMAL
        CSV_URL = session.csvUrl || '';
        WEBHOOK_URL = session.webhookUrl || '';
        currentUserId = session.userId;
        currentUserName = session.companyName || session.name;

        // Cambiar titulo
        const titleElement = document.getElementById('dashboard-client-title');
        if (titleElement) {
            titleElement.textContent = `dashboard: ${currentUserName}`;
        }

        // Mostrar botones de enlaces externos
        const linksContainer = document.getElementById('dashboard-external-links');
        if (linksContainer) {
            linksContainer.innerHTML = '';
            
            // Botón Agente Externo (Fijo)
            if (session.agenteExternoUrl) {
                linksContainer.innerHTML += `<a href="${session.agenteExternoUrl}" target="_blank" class="btn-optimizar" style="padding: 6px 15px; font-size: 0.85rem; background: rgba(56, 189, 248, 0.2); border-color: var(--accent-blue);">chat externo</a>`;
            } else {
                linksContainer.innerHTML += `<span class="btn-optimizar" style="padding: 6px 15px; font-size: 0.85rem; background: rgba(255, 255, 255, 0.05); border-color: transparent; opacity: 0.5; cursor: not-allowed;" title="No configurado">chat externo</span>`;
            }
            
            // Botón CRM (Fijo)
            if (session.crmUrl) {
                linksContainer.innerHTML += `<a href="${session.crmUrl}" target="_blank" class="btn-optimizar" style="padding: 6px 15px; font-size: 0.85rem; background: rgba(124, 58, 237, 0.2); border-color: rgba(124, 58, 237, 0.5);">abrir crm</a>`;
            } else {
                linksContainer.innerHTML += `<span class="btn-optimizar" style="padding: 6px 15px; font-size: 0.85rem; background: rgba(255, 255, 255, 0.05); border-color: transparent; opacity: 0.5; cursor: not-allowed;" title="No configurado">abrir crm</span>`;
            }
            
            // Botones Especiales (Dinámicos)
            if (session.specialButtons && session.specialButtons.length > 0) {
                session.specialButtons.forEach(btn => {
                    if (btn.name && btn.url) {
                        linksContainer.innerHTML += `<a href="${btn.url}" target="_blank" class="btn-optimizar" style="padding: 6px 15px; font-size: 0.85rem; background: rgba(244, 114, 182, 0.2); border-color: var(--accent-pink);">${btn.name.toLowerCase()}</a>`;
                    }
                });
            }
        }
    }

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

    if (!CSV_URL) {
        console.warn("No hay URL de CSV configurada para este usuario. Usando datos de prueba.");
        globalData = generateMockData();
        processAndRenderData(globalData);
    } else {
        Papa.parse(getDirectCsvUrl(CSV_URL), {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                // Normalize case for headers (convert all keys to lowercase to be safe)
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
                if (totalMessagesEl) totalMessagesEl.textContent = "Error";
            }
        });
    }

    // Event Listeners para Filtros de Fecha (input para updates fluidos)
    if (startDateEl) {
        startDateEl.addEventListener('change', filterData);
        startDateEl.addEventListener('input', filterData);
    }
    if (endDateEl) {
        endDateEl.addEventListener('change', filterData);
        endDateEl.addEventListener('input', filterData);
    }
}

// Procesa los datos y actualiza UI
function processAndRenderData(dataToProcess, isFirstLoad = false) {
    const data = dataToProcess || globalData;

    // Calcular Totales absolutos para que respete el 0
    const totalActividad = data ? data.length : 0;
    if (totalMessagesEl) totalMessagesEl.textContent = totalActividad.toLocaleString();

    if (!data || data.length === 0) {
        // En vez de ignorar y verse estático, blanquear la grilla para confirmar al usuario
        renderChart([], []);
        return;
    }

    // Helper robusto para parsear cualquier formato de Google Sheets/n8n
    function safeParseDate(rawDate) {
        if (!rawDate) return null;
        let str = String(rawDate).trim().split(' ')[0]; // Cortar "13/03/2026 15:30" -> "13/03/2026"
        str = str.split('T')[0]; // Cortar ISO "2026-03-13T15:30:00Z" -> "2026-03-13"
        
        const partsSlash = str.split('/');
        const partsDash = str.split('-');
        
        let d;
        if (partsSlash.length === 3) {
            // Asumir que si viene con barras comunes es DD/MM/YYYY (hispano)
            d = new Date(`${partsSlash[2]}-${partsSlash[1]}-${partsSlash[0]}T12:00:00`); 
        } else if (partsDash.length === 3 && partsDash[0].length === 2) {
            // Asumir DD-MM-YYYY
            d = new Date(`${partsDash[2]}-${partsDash[1]}-${partsDash[0]}T12:00:00`);
        } else {
            // Nativo (YYYY-MM-DD o formato inglés)
            d = new Date(str + 'T12:00:00'); 
            if (isNaN(d)) d = new Date(str); 
        }
        
        if (isNaN(d)) return null;
        return d;
    }

    // Agrupar por fecha
    const countsByDate = {};
    data.forEach(row => {
        let raw = row.fecha || row.Fecha || '';
        let d = safeParseDate(raw);
        
        let formattedDate = 'Desconocida';
        if (d) {
            // Extraer YYYY-MM-DD estricto para la agrupación interna
            formattedDate = d.toISOString().split('T')[0];
        }

        if (!countsByDate[formattedDate]) {
            countsByDate[formattedDate] = 0;
        }
        
        // Simplemente sumar 1 por cada fila (mensaje) en esa fecha
        countsByDate[formattedDate]++;
    });

    // Ordenar fechas cronológicamente
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

    // Renderizar Gráfico
    renderChart(chartLabels, chartData);

    // Configurar inputs de fecha a los rangos REALES de la base de datos para que nada se pierda
    if (sortedDates.length > 0 && startDateEl && !startDateEl.value) {
        try {
            let start = new Date(sortedDates[0]);
            let end = new Date(sortedDates[sortedDates.length - 1]);
            
            // Expandir un dia visualmente para que no queden pegados a los bordes
            start.setDate(start.getDate() - 1);
            end.setDate(end.getDate() + 1);

            startDateEl.value = start.toISOString().split('T')[0];
            endDateEl.value = end.toISOString().split('T')[0];
        } catch(e) {
            console.warn("Error autocompletando fechas:", e);
        }
    }
}

// Filtra los datos basado en los date pickers
function filterData() {
    if (!startDateEl || !endDateEl) return;
    
    let start = startDateEl.value ? new Date(startDateEl.value + 'T00:00:00') : null;
    let end = endDateEl.value ? new Date(endDateEl.value + 'T23:59:59') : null;

    const filteredData = globalData.filter(row => {
        let rawDate = row.fecha || row.Fecha;
        if (!rawDate) return false;
        
        // Replicar logica de parseo seguro
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
        
        if (isNaN(rowDate) || !rowDate) return false; // <--- ESTO CAUSABA EL BUG DEL FILTRO ESTATICO. Si no se entendía la fecha, la dejaba pasar. Ahora se oculta.

        if (start && rowDate < start) return false;
        if (end && rowDate > end) return false;
        return true;
    });

    processAndRenderData(filteredData);
}

// Renderiza el gráfico de líneas con Chart.js
function renderChart(labels, data) {
    const canvas = document.getElementById('responsesChart');
    if (!canvas) return; // Puede no existir si estamos en otra vista
    
    const ctx = canvas.getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
    }

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
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: function(context) { return `${context.parsed.y} respuestas`; }
                    }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false } },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false, tickLength: 0 },
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
            Fecha: date.toISOString().split('T')[0] + ' 10:00:00',
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
                body: JSON.stringify({
                    sessionId: SESSION_ID,
                    message: message
                })
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
                        const messages = textData.split('\n').filter(msg => msg.trim() !== '');
                        messages.forEach(msg => {
                            appendMessage('bot', msg);
                        });
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
            appendMessage('bot', "Error de red: Vía libre n8n (revisa CORS).");
        }
    });
}

// ==========================================================================
// Inicialización
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Solo inicia el dashboard config si estamos en una página que ocupa datos (grafico o chat)
    if (document.getElementById('responsesChart') || document.getElementById('chat-history')) {
        initializeDashboardConfig();
    }
});
