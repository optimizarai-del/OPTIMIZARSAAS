const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 80; // Default HTTP port in Docker/Easypanel

// Middleware
app.use(cors());
app.use(bodyParser.json());
// Sirve el frontend (Archivos HTML del directorio actual de forma estática)
app.use(express.static(path.join(__dirname, ''))); 

// =========================================================================
// DATABASE SETUP (SQLite)
// =========================================================================
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir); // Crear carpeta data/ si no existe
}

// Conectar a la base de datos (se guarda en disco duro)
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
        requiresPasswordChange INTEGER DEFAULT 0,
        createdAt TEXT
    )`, (err) => {
        if (err) console.error("Error creating tables:", err.message);
        else seedDefaultUsers();
    });
}

function seedDefaultUsers() {
    // Verificar si hay admins, si no, crear el default
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
                userId, 'Gabriel Riesco', 'Gabriel Riesco IA', 'gabrielriescoia@gmail.com', 'Optimizar-26', 'user', '["dashboard"]', 
                'https://docs.google.com/spreadsheets/d/e/2PACX-1vRylHtAg4p3VGtm4pKxMUgTyLyGN9CLGv4k1dDFRzKozzRPJZBlStGXJrjHL-gId5QPsV7IZRO-nPR3/pub?output=csv',
                'https://n8n.optimizar-ia.com/webhook/e69975da-3359-43cf-9970-f60ef990f726',
                0, new Date().toISOString()
            ]);
            console.log("Mock users created in DB");
        }
    });
}


// =========================================================================
// API ENDPOINTS
// =========================================================================

// 1. GET ALL USERS (Para la tabla de Admin)
app.get('/api/users', (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Parsear arrays JSON que vienen de texto plano
        const parsedRows = rows.map(r => ({
            ...r,
            allowedPages: r.allowedPages ? JSON.parse(r.allowedPages) : [],
            specialButtons: r.specialButtons ? JSON.parse(r.specialButtons) : [],
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
    
    // Check si el email ya existe
    db.get("SELECT id FROM users WHERE email = ?", [user.email], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });
        if (existing) return res.status(400).json({ success: false, message: 'El correo ya está registrado.' });
        
        const q = `INSERT INTO users (id, name, email, password, role, allowedPages, companyName, 
                   csvUrl, webhookUrl, crmUrl, agenteExternoUrl, specialButtons, requiresPasswordChange, createdAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                   
        const params = [
            id, user.name, user.email, user.password, user.role, 
            JSON.stringify(user.allowedPages || []), user.companyName || '',
            user.csvUrl || '', user.webhookUrl || '', user.crmUrl || '', user.agenteExternoUrl || '',
            JSON.stringify(user.specialButtons || []), user.requiresPasswordChange ? 1 : 0,
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
    
    // Construir SET dinámicamente basado en lo que manden
    let updateFields = [];
    let params = [];
    for (let key in updates) {
        // Ignoramos id 
        if(key === 'id') continue; 
        updateFields.push(`${key} = ?`);
        
        let value = updates[key];
        if (key === 'allowedPages' || key === 'specialButtons') {
            value = JSON.stringify(value); 
        } else if (key === 'requiresPasswordChange') {
            value = value ? 1 : 0;
        }
        params.push(value);
    }
    
    if (updateFields.length === 0) return res.json({ success: true }); // nada a actualizar
    
    params.push(id); // Para el WHERE id = ?
    
    const q = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    
    db.run(q, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, updated: this.changes });
    });
});

// 5. DELETE USER
app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    
    // Evitar borrar todos los admins - Logica delegada al frontend o aquí
    db.all("SELECT id FROM users WHERE role = 'admin'", [], (err, admins) => {
        if(err) return res.status(500).json({error: err.message});
        
        if(admins.length <= 1 && admins.find(a => a.id === id)) {
            return res.status(400).json({success: false, message: "No puedes eliminar el último administrador."});
        }
        
        db.run("DELETE FROM users WHERE id = ?", [id], function(err) {
             if (err) return res.status(500).json({ error: err.message });
             res.json({ success: true });
        });
    });
});


// Rutas Fallback de Express (Redirigir todo a index.html si no se encuentra para evitar 404 en navegacion tipo react, aunque aca son estaticos puntuales)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================================================================
// START SERVER
// =========================================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Optimizar Server is running on port ${PORT} bound to 0.0.0.0`);
});
