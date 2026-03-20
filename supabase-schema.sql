-- ================================================================
-- OPTIMIZAR SaaS — Supabase Schema
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ================================================================

-- Tabla: projects (configuración compartida por empresa/proyecto)
CREATE TABLE IF NOT EXISTS projects (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name                TEXT NOT NULL,
  csv_url             TEXT DEFAULT '',
  webhook_url         TEXT DEFAULT '',
  crm_url             TEXT DEFAULT '',
  agente_externo_url  TEXT DEFAULT '',
  special_buttons     JSONB DEFAULT '[]'::jsonb,
  action_buttons      JSONB DEFAULT '[]'::jsonb,
  custom_charts       JSONB DEFAULT '[]'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: users (usuarios individuales)
CREATE TABLE IF NOT EXISTS users (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name                     TEXT NOT NULL,
  email                    TEXT UNIQUE NOT NULL,
  password                 TEXT NOT NULL,
  role                     TEXT NOT NULL DEFAULT 'user',
  project_id               TEXT REFERENCES projects(id) ON DELETE SET NULL,
  is_project_owner         BOOLEAN DEFAULT FALSE,
  requires_password_change BOOLEAN DEFAULT FALSE,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: requirements (tareas de automatización por proyecto)
CREATE TABLE IF NOT EXISTS requirements (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL,
  user_name        TEXT NOT NULL DEFAULT 'Usuario',
  area             TEXT NOT NULL,
  tarea            TEXT NOT NULL,
  como_se_realiza  TEXT DEFAULT '',
  prioridad        TEXT NOT NULL DEFAULT 'media',
  tiempo_manual    TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: req_comments (comentarios de admins sobre requerimientos)
CREATE TABLE IF NOT EXISTS req_comments (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  requirement_id  TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  admin_id        TEXT NOT NULL,
  admin_name      TEXT NOT NULL,
  text            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Deshabilitar RLS (el servidor usa service key, no anon key)
ALTER TABLE projects      DISABLE ROW LEVEL SECURITY;
ALTER TABLE users         DISABLE ROW LEVEL SECURITY;
ALTER TABLE requirements  DISABLE ROW LEVEL SECURITY;
ALTER TABLE req_comments  DISABLE ROW LEVEL SECURITY;

-- ================================================================
-- SEED: Admin por defecto
-- Cambiar la contraseña desde el panel después del primer login
-- ================================================================
INSERT INTO users (id, name, email, password, role, is_project_owner, requires_password_change)
VALUES (
  'admin-default-001',
  'Admin Principal',
  'admin@optimizar-ia.com',
  'admin',
  'admin',
  FALSE,
  FALSE
) ON CONFLICT (email) DO NOTHING;
