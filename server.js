const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 80;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Sirve el frontend estático
app.use(express.static(path.join(__dirname, '')));

// =========================================================================
// DATABASE SETUP (SQLite)
// =========================================================================
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const db = new sqlite3.Database(path.join(dataDir, 'database.sqlite'), (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    allowedPages TEXT,
    companyName TEXT,
    csvUrl TEXT,
    webhookUrl TEXT,
    crmUrl TEXT,
    agenteExternoUrl TEXT,
    specialButtons TEXT,
    actionButtons TEXT,
    customCharts TEXT,
    requiresPasswordChange INTEGER DEFAULT 0,
    createdAt TEXT
  )`, (err) => {
    if (err) console.error("Error creating tables:", err.message);
    else {
      db.run(`ALTER TABLE users ADD COLUMN actionButtons TEXT`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN customCharts TEXT`, () => {});
      seedDefaultUsers();
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS requirements (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    area TEXT NOT NULL,
    tarea TEXT NOT NULL,
    comoSeRealiza TEXT,
    prioridad TEXT NOT NULL DEFAULT 'media',
    tiempoManual TEXT,
    createdAt TEXT
  )`, (err) => {
    if (err) console.error("Error creating requirements table:", err.message);
  });
}

function seedDefaultUsers() {
  db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'", (err, row) => {
    if (!err && row.count === 0) {
      const adminId = Date.now().toString() + "-admin";
      const adminQuery = `INSERT INTO users (id, name, email, password, role, allowedPages, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
      db.run(adminQuery, [adminId, 'Admin Principal', 'admin@optimizar-ia.com', 'admin', 'admin', '["all"]', new Date().toISOString()]);

      const userId = Date.now().toString() + "-user";
      const userQuery = `INSERT INTO users (id, name, companyName, email, password, role, allowedPages, csvUrl, webhookUrl, requiresPasswordChange, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      db.run(userQuery, [
        userId,
        'Gabriel Riesco',
        'Gabriel Riesco IA',
        'gabrielriescoia@gmail.com',
        'Optimizar-26',
        'user',
        '["dashboard"]',
        'https://docs.google.com/spreadsheets/d/e/2PACX-1vRylHtAg4p3VGtm4pKxMUgTyLyGN9CLGv4k1dDFRzKozzRPJZBlStGXJrjHL-gId5QPsV7IZRO-nPR3/pub?output=csv',
        'https://n8n.optimizar-ia.com/webhook/e69975da-3359-43cf-9970-f60ef990f726',
        0,
        new Date().toISOString()
      ]);
      console.log("Default users created in DB");
    }
  });
}

// =========================================================================
// [FIX BUG 2] PROXY CSV — Evita el bloqueo CORS de Google Sheets
// El frontend llama a /api/proxy-csv?url=... y el servidor descarga el CSV
// server-side (sin restricciones CORS) y lo reenvía al cliente.
// =========================================================================
app.get('/api/proxy-csv', (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Parámetro "url" requerido.' });
  }

  // Validación de seguridad: solo permitir Google Sheets y URLs https
  const allowedHosts = ['docs.google.com', 'spreadsheets.google.com'];
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (e) {
    return res.status(400).json({ error: 'URL inválida.' });
  }

  if (!allowedHosts.includes(parsedUrl.hostname)) {
    return res.status(403).json({ error: 'Host no permitido. Solo se permiten URLs de Google Sheets.' });
  }

  const requester = parsedUrl.protocol === 'https:' ? https : http;

  const proxyReq = requester.get(targetUrl, (proxyRes) => {
    // Seguir redirecciones manualmente (Google Sheets redirige)
    if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      const redirectUrl = proxyRes.headers.location;
      const redirectRequester = redirectUrl.startsWith('https') ? https : http;
      redirectRequester.get(redirectUrl, (redirectRes) => {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        redirectRes.pipe(res);
      }).on('error', (err) => {
        console.error('Error en redirección proxy CSV:', err.message);
        res.status(500).json({ error: 'Error al seguir redirección del CSV.' });
      });
      return;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Error en proxy CSV:', err.message);
    res.status(500).json({ error: 'No se pudo descargar el CSV.' });
  });

  proxyReq.setTimeout(15000, () => {
    proxyReq.destroy();
    res.status(504).json({ error: 'Timeout al descargar el CSV.' });
  });
});

// =========================================================================
// API ENDPOINTS
// =========================================================================

// 1. GET ALL USERS
app.get('/api/users', (req, res) => {
  db.all("SELECT * FROM users", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const parsedRows = rows.map(r => ({
      ...r,
      allowedPages: r.allowedPages ? JSON.parse(r.allowedPages) : [],
      specialButtons: r.specialButtons ? JSON.parse(r.specialButtons) : [],
      actionButtons: r.actionButtons ? JSON.parse(r.actionButtons) : [],
      customCharts: r.customCharts ? JSON.parse(r.customCharts) : [],
      requiresPasswordChange: r.requiresPasswordChange === 1
    }));
    res.json(parsedRows);
  });
});

// 2. LOGIN
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos.' });

    const sessionData = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      companyName: user.companyName || '',
      allowedPages: user.allowedPages ? JSON.parse(user.allowedPages) : [],
      csvUrl: user.csvUrl || '',
      webhookUrl: user.webhookUrl || '',
      crmUrl: user.crmUrl || '',
      agenteExternoUrl: user.agenteExternoUrl || '',
      specialButtons: user.specialButtons ? JSON.parse(user.specialButtons) : [],
      actionButtons: user.actionButtons ? JSON.parse(user.actionButtons) : [],
      customCharts: user.customCharts ? JSON.parse(user.customCharts) : [],
      requiresPasswordChange: user.requiresPasswordChange === 1,
      loginTime: new Date().toISOString()
    };

    res.json({ success: true, session: sessionData });
  });
});

// 3. CREATE USER
app.post('/api/users', (req, res) => {
  const user = req.body;
  const id = Date.now().toString() + Math.random().toString(36).substring(7);

  db.get("SELECT id FROM users WHERE email = ?", [user.email], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(400).json({ success: false, message: 'El correo ya está registrado.' });

    const q = `INSERT INTO users
      (id, name, email, password, role, allowedPages, companyName, csvUrl, webhookUrl, crmUrl, agenteExternoUrl, specialButtons, actionButtons, customCharts, requiresPasswordChange, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      id,
      user.name,
      user.email,
      user.password,
      user.role,
      JSON.stringify(user.allowedPages || []),
      user.companyName || '',
      user.csvUrl || '',
      user.webhookUrl || '',
      user.crmUrl || '',
      user.agenteExternoUrl || '',
      JSON.stringify(user.specialButtons || []),
      JSON.stringify(user.actionButtons || []),
      JSON.stringify(user.customCharts || []),
      user.requiresPasswordChange ? 1 : 0,
      new Date().toISOString()
    ];

    db.run(q, params, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, user: { id, ...user } });
    });
  });
});

// 4. UPDATE USER
app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  let updateFields = [];
  let params = [];

  for (let key in updates) {
    if (key === 'id') continue;
    updateFields.push(`${key} = ?`);
    let value = updates[key];
    if (['allowedPages', 'specialButtons', 'actionButtons', 'customCharts'].includes(key)) {
      value = JSON.stringify(value);
    } else if (key === 'requiresPasswordChange') {
      value = value ? 1 : 0;
    }
    params.push(value);
  }

  if (updateFields.length === 0) return res.json({ success: true });

  params.push(id);
  const q = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;

  db.run(q, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, updated: this.changes });
  });
});

// 5. DELETE USER
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  db.all("SELECT id FROM users WHERE role = 'admin'", [], (err, admins) => {
    if (err) return res.status(500).json({ error: err.message });
    if (admins.length <= 1 && admins.find(a => a.id === id)) {
      return res.status(400).json({ success: false, message: "No puedes eliminar el último administrador." });
    }
    db.run("DELETE FROM users WHERE id = ?", [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// =========================================================================
// REQUIREMENTS ENDPOINTS
// =========================================================================

// GET requirements for a user (sorted by priority)
app.get('/api/requirements', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId requerido.' });
  const q = `SELECT * FROM requirements WHERE userId = ?
    ORDER BY CASE prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baja' THEN 3 ELSE 4 END, createdAt DESC`;
  db.all(q, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST create requirement
app.post('/api/requirements', (req, res) => {
  const { userId, area, tarea, comoSeRealiza, prioridad, tiempoManual } = req.body;
  if (!userId || !area || !tarea || !prioridad) {
    return res.status(400).json({ success: false, message: 'Campos requeridos faltantes.' });
  }
  const id = Date.now().toString() + Math.random().toString(36).substring(7);
  const q = `INSERT INTO requirements (id, userId, area, tarea, comoSeRealiza, prioridad, tiempoManual, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(q, [id, userId, area, tarea, comoSeRealiza || '', prioridad, tiempoManual || '', new Date().toISOString()], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, requirement: { id, userId, area, tarea, comoSeRealiza, prioridad, tiempoManual } });
  });
});

// DELETE requirement
app.delete('/api/requirements/:id', (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM requirements WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Fallback: redirigir rutas desconocidas a index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================================================================
// START SERVER
// =========================================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Optimizar Server is running on port ${PORT} bound to 0.0.0.0`);
});
