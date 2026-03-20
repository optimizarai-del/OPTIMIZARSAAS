const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const https = require('https');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 80;

// =========================================================================
// SUPABASE CLIENT (usa service key para bypass de RLS)
// Variables de entorno requeridas en EasyPanel:
//   SUPABASE_URL          = https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY  = clave de rol "service_role"
// =========================================================================
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '')));

// =========================================================================
// HELPER: mapUser
// Fusiona los campos del proyecto (project) dentro del objeto usuario
// para mantener compatibilidad con el frontend existente.
// =========================================================================
function mapUser(u) {
  const p = u.projects || {};
  return {
    id:                      u.id,
    name:                    u.name,
    email:                   u.email,
    password:                u.password,
    role:                    u.role,
    projectId:               u.project_id               || null,
    isProjectOwner:          u.is_project_owner         || false,
    requiresPasswordChange:  u.requires_password_change || false,
    createdAt:               u.created_at,
    // Campos del proyecto (compartidos por todos los miembros):
    companyName:      p.name               || '',
    csvUrl:           p.csv_url            || '',
    webhookUrl:       p.webhook_url        || '',
    crmUrl:           p.crm_url            || '',
    agenteExternoUrl: p.agente_externo_url || '',
    specialButtons:   p.special_buttons    || [],
    actionButtons:    p.action_buttons     || [],
    customCharts:     p.custom_charts      || [],
    allowedPages:     u.role === 'admin' ? ['all'] : ['dashboard'],
  };
}

// =========================================================================
// PROXY CSV — Evita bloqueo CORS de Google Sheets
// =========================================================================
app.get('/api/proxy-csv', (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Parámetro "url" requerido.' });

  const allowedHosts = ['docs.google.com', 'spreadsheets.google.com'];
  let parsedUrl;
  try { parsedUrl = new URL(targetUrl); } catch (e) { return res.status(400).json({ error: 'URL inválida.' }); }
  if (!allowedHosts.includes(parsedUrl.hostname)) return res.status(403).json({ error: 'Host no permitido.' });

  const requester = parsedUrl.protocol === 'https:' ? https : http;
  const proxyReq = requester.get(targetUrl, (proxyRes) => {
    if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      const redir = proxyRes.headers.location;
      const rReq = (redir.startsWith('https') ? https : http).get(redir, (rRes) => {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        rRes.pipe(res);
      });
      rReq.on('error', () => res.status(500).json({ error: 'Error en redirección.' }));
      return;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    proxyRes.pipe(res);
  });
  proxyReq.on('error', () => res.status(500).json({ error: 'No se pudo descargar el CSV.' }));
  proxyReq.setTimeout(15000, () => { proxyReq.destroy(); res.status(504).json({ error: 'Timeout.' }); });
});

// =========================================================================
// USERS API (compatible con frontend existente)
// =========================================================================

// 1. GET ALL USERS (con datos del proyecto fusionados)
app.get('/api/users', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*, projects(*)');
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(mapUser));
});

// 2. LOGIN
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase
    .from('users')
    .select('*, projects(*)')
    .eq('email', email)
    .eq('password', password)
    .single();
  if (error || !data) return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos.' });
  res.json({ success: true, session: mapUser(data) });
});

// 3. CREATE USER
//   - role='user' sin projectId → crea proyecto nuevo + usuario propietario
//   - role='user' con projectId  → agrega miembro a proyecto existente
//   - role='admin'               → crea admin sin proyecto
app.post('/api/users', async (req, res) => {
  const user = req.body;
  const id = Date.now().toString() + Math.random().toString(36).substring(7);

  const { data: existing } = await supabase.from('users').select('id').eq('email', user.email).single();
  if (existing) return res.status(400).json({ success: false, message: 'El correo ya está registrado.' });

  let projectId = user.projectId || null;

  if (user.role === 'user' && !projectId) {
    // Crear proyecto primero
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .insert({
        name:               user.companyName        || user.name,
        csv_url:            user.csvUrl             || '',
        webhook_url:        user.webhookUrl         || '',
        crm_url:            user.crmUrl             || '',
        agente_externo_url: user.agenteExternoUrl   || '',
        special_buttons:    user.specialButtons     || [],
        action_buttons:     user.actionButtons      || [],
        custom_charts:      user.customCharts       || [],
      })
      .select()
      .single();
    if (projErr) return res.status(500).json({ error: projErr.message });
    projectId = project.id;
  }

  const { error } = await supabase.from('users').insert({
    id,
    name:                    user.name,
    email:                   user.email,
    password:                user.password,
    role:                    user.role,
    project_id:              projectId,
    is_project_owner:        user.role === 'user' && !user.projectId,
    requires_password_change: user.requiresPasswordChange || false,
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, user: { id, ...user, projectId } });
});

// 4. UPDATE USER
//   - Campos de usuario (name, email, password) → tabla users
//   - Campos de proyecto (csvUrl, companyName, etc.) → tabla projects
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const { data: currentUser } = await supabase.from('users').select('project_id, role').eq('id', id).single();
  const userUpdates    = {};
  const projectUpdates = {};

  for (const key in updates) {
    if (key === 'id' || key === 'projectId') continue;
    if (key === 'name')     userUpdates.name     = updates[key];
    if (key === 'email')    userUpdates.email    = updates[key];
    if (key === 'password') userUpdates.password = updates[key];
    if (key === 'requiresPasswordChange') userUpdates.requires_password_change = updates[key];
    if (key === 'companyName')       projectUpdates.name               = updates[key];
    if (key === 'csvUrl')            projectUpdates.csv_url            = updates[key];
    if (key === 'webhookUrl')        projectUpdates.webhook_url        = updates[key];
    if (key === 'crmUrl')            projectUpdates.crm_url            = updates[key];
    if (key === 'agenteExternoUrl')  projectUpdates.agente_externo_url = updates[key];
    if (key === 'specialButtons')    projectUpdates.special_buttons    = updates[key];
    if (key === 'actionButtons')     projectUpdates.action_buttons     = updates[key];
    if (key === 'customCharts')      projectUpdates.custom_charts      = updates[key];
  }

  if (Object.keys(userUpdates).length > 0) {
    const { error } = await supabase.from('users').update(userUpdates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
  }
  if (Object.keys(projectUpdates).length > 0 && currentUser?.project_id) {
    const { error } = await supabase.from('projects').update(projectUpdates).eq('id', currentUser.project_id);
    if (error) return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

// 5. DELETE USER
//   - Si era propietario: reasigna o elimina el proyecto
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;

  const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
  if (admins && admins.length <= 1 && admins.find(a => a.id === id)) {
    return res.status(400).json({ success: false, message: 'No puedes eliminar el último administrador.' });
  }

  const { data: user } = await supabase.from('users').select('project_id, is_project_owner').eq('id', id).single();
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  if (user?.is_project_owner && user?.project_id) {
    const { data: remaining } = await supabase.from('users').select('id').eq('project_id', user.project_id);
    if (!remaining || remaining.length === 0) {
      await supabase.from('projects').delete().eq('id', user.project_id);
    } else {
      await supabase.from('users').update({ is_project_owner: true }).eq('id', remaining[0].id);
    }
  }

  res.json({ success: true });
});

// =========================================================================
// PROJECT MEMBERS API
// =========================================================================

// GET miembros de un proyecto
app.get('/api/projects/:projectId/members', async (req, res) => {
  const { projectId } = req.params;
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, is_project_owner, requires_password_change, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// POST agregar miembro a proyecto existente
app.post('/api/projects/:projectId/members', async (req, res) => {
  const { projectId } = req.params;
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Nombre, correo y contraseña son requeridos.' });

  const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
  if (existing) return res.status(400).json({ success: false, message: 'El correo ya está registrado.' });

  const id = Date.now().toString() + Math.random().toString(36).substring(7);
  const { error } = await supabase.from('users').insert({
    id, name, email, password,
    role: 'user',
    project_id: projectId,
    is_project_owner: false,
    requires_password_change: true,
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, member: { id, name, email } });
});

// DELETE remover miembro de un proyecto (no puede ser el propietario)
app.delete('/api/projects/:projectId/members/:userId', async (req, res) => {
  const { userId } = req.params;
  const { data: user } = await supabase.from('users').select('is_project_owner').eq('id', userId).single();
  if (user?.is_project_owner) {
    return res.status(400).json({ success: false, message: 'No puedes eliminar al responsable del proyecto. Eliminalo desde "Borrar proyecto".' });
  }
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// =========================================================================
// REQUIREMENTS API
// =========================================================================

app.get('/api/requirements', async (req, res) => {
  const { projectId, userId } = req.query;
  let finalProjectId = projectId;

  if (!finalProjectId && userId) {
    const { data: user } = await supabase.from('users').select('project_id').eq('id', userId).single();
    finalProjectId = user?.project_id;
  }
  if (!finalProjectId) return res.json([]);

  const { data, error } = await supabase
    .from('requirements')
    .select('*')
    .eq('project_id', finalProjectId);
  if (error) return res.status(500).json({ error: error.message });

  const priority = { alta: 1, media: 2, baja: 3 };
  const sorted = (data || []).sort((a, b) =>
    (priority[a.prioridad] || 4) - (priority[b.prioridad] || 4) ||
    new Date(b.created_at) - new Date(a.created_at)
  );

  res.json(sorted.map(r => ({
    id:            r.id,
    projectId:     r.project_id,
    userId:        r.user_id,
    userName:      r.user_name,
    area:          r.area,
    tarea:         r.tarea,
    comoSeRealiza: r.como_se_realiza,
    prioridad:     r.prioridad,
    tiempoManual:  r.tiempo_manual,
    createdAt:     r.created_at,
  })));
});

app.post('/api/requirements', async (req, res) => {
  const { userId, projectId, area, tarea, comoSeRealiza, prioridad, tiempoManual, userName } = req.body;
  let finalProjectId = projectId;
  let finalUserName  = userName;

  if (!finalProjectId || !finalUserName) {
    const { data: user } = await supabase.from('users').select('project_id, name').eq('id', userId).single();
    if (!finalProjectId) finalProjectId = user?.project_id;
    if (!finalUserName)  finalUserName  = user?.name || 'Usuario';
  }

  if (!finalProjectId || !area || !tarea || !prioridad) {
    return res.status(400).json({ success: false, message: 'Faltan campos requeridos.' });
  }

  const id = Date.now().toString() + Math.random().toString(36).substring(7);
  const { error } = await supabase.from('requirements').insert({
    id,
    project_id:      finalProjectId,
    user_id:         userId  || 'unknown',
    user_name:       finalUserName,
    area, tarea,
    como_se_realiza: comoSeRealiza || '',
    prioridad,
    tiempo_manual:   tiempoManual  || '',
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, requirement: { id, projectId: finalProjectId, area, tarea, prioridad } });
});

app.delete('/api/requirements/:id', async (req, res) => {
  const { id } = req.params;
  await supabase.from('req_comments').delete().eq('requirement_id', id);
  const { error } = await supabase.from('requirements').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// =========================================================================
// COMMENTS API
// =========================================================================

app.get('/api/comments', async (req, res) => {
  const { requirementId } = req.query;
  if (!requirementId) return res.status(400).json({ error: 'requirementId requerido.' });
  const { data, error } = await supabase
    .from('req_comments')
    .select('*')
    .eq('requirement_id', requirementId)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(c => ({
    id:            c.id,
    requirementId: c.requirement_id,
    adminId:       c.admin_id,
    adminName:     c.admin_name,
    text:          c.text,
    createdAt:     c.created_at,
  })));
});

app.post('/api/comments', async (req, res) => {
  const { requirementId, adminId, adminName, text } = req.body;
  if (!requirementId || !adminId || !text) return res.status(400).json({ success: false, message: 'Campos requeridos.' });
  const id = Date.now().toString() + Math.random().toString(36).substring(7);
  const { error } = await supabase.from('req_comments').insert({
    id, requirement_id: requirementId, admin_id: adminId, admin_name: adminName, text,
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, comment: { id, requirementId, adminId, adminName, text, createdAt: new Date().toISOString() } });
});

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Optimizar Server running on port ${PORT}`);
});
