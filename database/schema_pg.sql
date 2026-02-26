-- ============================================================
-- CRM SYSTEM — PostgreSQL Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Trigger Function for Updated At ──────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ── Roles ────────────────────────────────────────────────────
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_roles_nombre ON roles(nombre);

INSERT INTO roles (id, nombre, descripcion) VALUES
(1, 'super_admin', 'Administrador del sistema'),
(2, 'admin', 'Administrador'),
(3, 'admin_rrhh', 'Administrador de Recursos Humanos'),
(4, 'employee', 'Empleado')
ON CONFLICT (id) DO NOTHING;

-- ── Permisos ─────────────────────────────────────────────────
CREATE TABLE permisos (
    id SERIAL PRIMARY KEY,
    modulo VARCHAR(100) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    UNIQUE (modulo, accion)
);

-- ── Roles-Permisos ──────────────────────────────────────────
CREATE TABLE roles_permisos (
    role_id INTEGER NOT NULL,
    permiso_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permiso_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE
);

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'employee',
    role_id INTEGER NOT NULL DEFAULT 4,
    employee_id VARCHAR(36) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    primer_acceso BOOLEAN NOT NULL DEFAULT FALSE,
    temp_password VARCHAR(255) NULL,
    refresh_token TEXT NULL,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);

-- ── Employees ─────────────────────────────────────────────────
CREATE TABLE employees (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(30) NULL,
    employee_type VARCHAR(50) NOT NULL DEFAULT 'other',
    department VARCHAR(100) NULL,
    position VARCHAR(100) NULL,
    hire_date DATE NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    photo_url VARCHAR(500) NULL,
    bio TEXT NULL,
    salary DECIMAL(10,2) NULL,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_type ON employees(employee_type);
CREATE INDEX idx_employees_email ON employees(email);

CREATE TRIGGER update_employees_updated_at 
BEFORE UPDATE ON employees 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Web Analytics ───────────────────────────────────────────
CREATE TABLE web_analytics (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(36) NULL,
    event_type VARCHAR(50) NOT NULL,
    path VARCHAR(500) NULL,
    element VARCHAR(255) NULL,
    ip VARCHAR(45) NOT NULL DEFAULT '',
    user_agent TEXT NULL,
    device_type VARCHAR(50) NOT NULL DEFAULT 'desktop',
    referrer VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_session ON web_analytics(session_id);
CREATE INDEX idx_analytics_event_type ON web_analytics(event_type);
CREATE INDEX idx_analytics_created ON web_analytics(created_at);

-- ── Audit Logs ──────────────────────────────────────────────
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(36) NULL,
    action VARCHAR(100) NOT NULL,
    ip VARCHAR(45) NOT NULL DEFAULT '',
    user_agent TEXT NULL,
    meta JSONB NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- ── Registro Auditoría (Duplicates) ─────────────────────────
CREATE TABLE registro_auditoria (
    id BIGSERIAL PRIMARY KEY,
    admin_id VARCHAR(36) NULL,
    nombre_nuevo VARCHAR(150) NOT NULL,
    email_nuevo VARCHAR(255) NOT NULL,
    nombre_similar VARCHAR(150) NULL,
    email_similar VARCHAR(255) NULL,
    similitud INTEGER NOT NULL,
    accion VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ── Notificaciones ──────────────────────────────────────────
CREATE TABLE notificaciones (
    id BIGSERIAL PRIMARY KEY,
    usuario_id VARCHAR(36) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'info',
    enlace VARCHAR(500) NULL,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    leida_at TIMESTAMP NULL,
    creado_por VARCHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notif_usuario ON notificaciones(usuario_id);
CREATE INDEX idx_notif_leida ON notificaciones(leida);

-- ── Eventos Calendario ──────────────────────────────────────
CREATE TABLE eventos_calendario (
    id BIGSERIAL PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT NULL,
    fecha_inicio TIMESTAMP NOT NULL,
    fecha_fin TIMESTAMP NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'evento',
    color VARCHAR(20) NOT NULL DEFAULT '#4f8ef7',
    todo_el_dia BOOLEAN NOT NULL DEFAULT FALSE,
    creado_por VARCHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creado_por) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_events_fecha ON eventos_calendario(fecha_inicio);

CREATE TRIGGER update_events_updated_at 
BEFORE UPDATE ON eventos_calendario 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Asistencia ──────────────────────────────────────────────
CREATE TABLE asistencia_registros (
    id BIGSERIAL PRIMARY KEY,
    usuario_id VARCHAR(36) NOT NULL,
    fecha DATE NOT NULL,
    hora_entrada TIME NULL,
    hora_salida TIME NULL,
    minutos_trabajo INTEGER NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'presente',
    observaciones TEXT NULL,
    registrado_por VARCHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (registrado_por) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (usuario_id, fecha)
);

CREATE INDEX idx_asist_usuario_fecha ON asistencia_registros(usuario_id, fecha);

CREATE TRIGGER update_asist_updated_at 
BEFORE UPDATE ON asistencia_registros 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Ausencias ──────────────────────────────────────────────
CREATE TABLE ausencias (
    id BIGSERIAL PRIMARY KEY,
    employee_id VARCHAR(36) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    razon TEXT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
    aprobada_por VARCHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (aprobada_por) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_ausencia_employee ON ausencias(employee_id);
CREATE INDEX idx_ausencia_estado ON ausencias(estado);

-- ── Proyectos ───────────────────────────────────────────────
CREATE TABLE proyectos (
    id VARCHAR(36) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT NULL,
    logo_url VARCHAR(500) NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'planificacion',
    fecha_inicio DATE NULL,
    fecha_fin DATE NULL,
    responsable_id VARCHAR(36) NULL,
    presupuesto DECIMAL(12,2) NULL,
    creado_por VARCHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (responsable_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (creado_por) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_proyecto_estado ON proyectos(estado);

CREATE TRIGGER update_proyecto_updated_at 
BEFORE UPDATE ON proyectos 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Tareas ──────────────────────────────────────────────────
CREATE TABLE tareas (
    id BIGSERIAL PRIMARY KEY,
    proyecto_id VARCHAR(36) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'por_hacer',
    prioridad VARCHAR(50) NOT NULL DEFAULT 'media',
    asignado_a VARCHAR(36) NULL,
    fecha_vencimiento DATE NULL,
    fecha_inicio DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    FOREIGN KEY (asignado_a) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX idx_tarea_proyecto ON tareas(proyecto_id);
CREATE INDEX idx_tarea_estado ON tareas(estado);

CREATE TRIGGER update_tarea_updated_at 
BEFORE UPDATE ON tareas 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Alias for legacy code
CREATE TABLE tareas_proyecto (
    id VARCHAR(36) PRIMARY KEY,
    proyecto_id VARCHAR(36) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT NULL,
    asignado_a VARCHAR(36) NULL,
    prioridad VARCHAR(50) NOT NULL DEFAULT 'media',
    estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
    fecha_limite DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    FOREIGN KEY (asignado_a) REFERENCES employees(id) ON DELETE SET NULL
);

-- ── Ventas ──────────────────────────────────────────────────
CREATE TABLE ventas (
    id VARCHAR(36) PRIMARY KEY,
    cliente_nombre VARCHAR(255) NOT NULL,
    concepto VARCHAR(255) NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    fecha DATE NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'prospecto',
    probabilidad INTEGER NULL DEFAULT 0,
    fecha_cierre DATE NULL,
    vendedor_id VARCHAR(36) NULL,
    metodo_pago VARCHAR(50) NULL,
    observaciones TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendedor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_venta_estado ON ventas(estado);
CREATE INDEX idx_venta_vendedor ON ventas(vendedor_id);

CREATE TRIGGER update_venta_updated_at 
BEFORE UPDATE ON ventas 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Alias for legacy code transacciones_financieras
CREATE TABLE transacciones_financieras (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL, -- ingreso/egreso
    concepto VARCHAR(255) NOT NULL,
    categoria VARCHAR(100) NOT NULL DEFAULT 'General',
    monto DECIMAL(12,2) NOT NULL,
    metodo_pago VARCHAR(50) NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'completada',
    referencia VARCHAR(100) NULL,
    fecha DATE NOT NULL,
    registrado_por VARCHAR(36) NULL,
    observaciones TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (registrado_por) REFERENCES users(id) ON DELETE SET NULL
);

-- ── Finanzas ──────────────────────────────────────────────
CREATE TABLE finanzas (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    descripcion TEXT NULL,
    fecha DATE NOT NULL,
    responsable_id VARCHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (responsable_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_finanza_tipo ON finanzas(tipo);
CREATE INDEX idx_finanza_cat ON finanzas(categoria);
CREATE INDEX idx_finanza_fecha ON finanzas(fecha);

-- ── Config Global ──────────────────────────────────────────
CREATE TABLE config_global (
    key_name VARCHAR(100) PRIMARY KEY,
    value_content TEXT NOT NULL,
    description TEXT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO config_global (key_name, value_content, description) VALUES
('APP_NAME', 'CRM Nexus Enterprise', 'Nombre oficial de la plataforma'),
('APP_VERSION', '2.5.0-stable', 'Versión actual del sistema'),
('COMPANY_NAME', 'Nexus Technologies S.A.C.', 'Razón social de la empresa'),
('SUPPORT_EMAIL', 'soporte@nexus.com', 'Correo de contacto técnico'),
('MAINTENANCE_MODE', 'false', 'Estado de mantenimiento del sitio'),
('THEME_DEFAULT', 'light', 'Tema visual predeterminado'),
('CURRENCY_SYMBOL', '$', 'Símbolo monetario para finanzas');

-- ── Evaluaciones Desempeño ──────────────────────────────────
CREATE TABLE evaluaciones_desempeno (
    id VARCHAR(36) PRIMARY KEY,
    employee_id VARCHAR(36) NOT NULL,
    evaluador_id VARCHAR(36) NOT NULL,
    puntaje INTEGER NOT NULL,
    comentario TEXT NULL,
    fecha DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (evaluador_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_eval_employee ON evaluaciones_desempeno(employee_id);
CREATE INDEX idx_eval_fecha ON evaluaciones_desempeno(fecha);

-- ── Objetivos ───────────────────────────────────────────────
CREATE TABLE objetivos (
    id VARCHAR(36) PRIMARY KEY,
    employee_id VARCHAR(36) NOT NULL,
    admin_id VARCHAR(36) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT NULL,
    avance INTEGER NOT NULL DEFAULT 0,
    estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
    fecha_limite DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_objetivo_employee ON objetivos(employee_id);
CREATE INDEX idx_objetivo_estado ON objetivos(estado);

CREATE TRIGGER update_objetivo_updated_at 
BEFORE UPDATE ON objetivos 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Sessions (connect-pg-simple) ───────────────────────────
CREATE TABLE "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
) WITH (OIDS=FALSE);

CREATE INDEX "IDX_session_expire" ON "session" ("expire");

-- ── OTPs ────────────────────────────────────────────────────
CREATE TABLE otps (
    id VARCHAR(36) PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_otp_email ON otps(user_email);
CREATE INDEX idx_otp_expires ON otps(expires_at);

-- ── Login Intentos ──────────────────────────────────────────
CREATE TABLE login_intentos (
    id SERIAL PRIMARY KEY,
    ip VARCHAR(45) NOT NULL,
    email VARCHAR(255) NOT NULL,
    intentos INTEGER DEFAULT 1,
    bloqueado_hasta TIMESTAMP NULL,
    ultimo_intento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (ip, email)
);

CREATE INDEX idx_login_email_ip ON login_intentos(email, ip);
CREATE INDEX idx_login_created ON login_intentos(created_at);

-- ── Intento de IP ────────────────────────────────────────────
CREATE TABLE ip_attempts (
    id BIGSERIAL PRIMARY KEY,
    ip VARCHAR(45) NOT NULL UNIQUE,
    attempts INTEGER NOT NULL DEFAULT 1,
    last_attempt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Default Admin User
INSERT INTO users (id, name, email, password, role, role_id, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Administrador System',
    'admin@crm.com',
    '$2b$12$BdcwjI6l9x/WoGQc70BVSOSMLRXD9A249cSuUZZhDIXYza5uNDH2O',
    'super_admin',
    1,
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- Seed Permisos
INSERT INTO permisos (modulo, accion, label) VALUES
('RRHH', 'ver', 'RRHH > ver'), ('RRHH', 'crear', 'RRHH > crear'), ('RRHH', 'editar', 'RRHH > editar'), ('RRHH', 'eliminar', 'RRHH > eliminar'), ('RRHH', 'exportar', 'RRHH > exportar'),
('Desempeno', 'ver', 'Desempeno > ver'), ('Desempeno', 'crear', 'Desempeno > crear'), ('Desempeno', 'editar', 'Desempeno > editar'), ('Desempeno', 'eliminar', 'Desempeno > eliminar'), ('Desempeno', 'exportar', 'Desempeno > exportar'),
('Objetivos', 'ver', 'Objetivos > ver'), ('Objetivos', 'crear', 'Objetivos > crear'), ('Objetivos', 'editar', 'Objetivos > editar'), ('Objetivos', 'eliminar', 'Objetivos > eliminar'), ('Objetivos', 'exportar', 'Objetivos > exportar'),
('Auditoria', 'ver', 'Auditoria > ver'), ('Auditoria', 'exportar', 'Auditoria > exportar'),
('Analitica', 'ver', 'Analitica > ver'), ('Analitica', 'exportar', 'Analitica > exportar'),
('Configuracion', 'ver', 'Configuracion > ver'), ('Configuracion', 'crear', 'Configuracion > crear'), ('Configuracion', 'editar', 'Configuracion > editar'), ('Configuracion', 'eliminar', 'Configuracion > eliminar'),
('Finanzas', 'ver', 'Finanzas > ver'), ('Finanzas', 'crear', 'Finanzas > crear'), ('Finanzas', 'editar', 'Finanzas > editar'), ('Finanzas', 'eliminar', 'Finanzas > eliminar'),
('Asistencia', 'ver', 'Asistencia > ver'), ('Asistencia', 'editar', 'Asistencia > editar'),
('Proyectos', 'ver', 'Proyectos > ver'), ('Proyectos', 'crear', 'Proyectos > crear'), ('Proyectos', 'editar', 'Proyectos > editar'), ('Proyectos', 'eliminar', 'Proyectos > eliminar'),
('Ventas', 'ver', 'Ventas > ver'), ('Ventas', 'crear', 'Ventas > crear'), ('Ventas', 'editar', 'Ventas > editar'), ('Ventas', 'eliminar', 'Ventas > eliminar');

-- Assign all to super_admin
INSERT INTO roles_permisos (role_id, permiso_id)
SELECT 1, id FROM permisos;

-- Assign to other roles (simplified)
INSERT INTO roles_permisos (role_id, permiso_id)
SELECT 2, id FROM permisos; -- admin has all too
INSERT INTO roles_permisos (role_id, permiso_id)
SELECT 3, id FROM permisos WHERE modulo IN ('RRHH', 'Desempeno', 'Objetivos', 'Auditoria'); -- RRHH

-- Synchronize sequences for SERIAL columns
SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));
