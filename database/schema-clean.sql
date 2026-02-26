-- ============================================================
-- CRM SYSTEM — MySQL Schema (COMPLETO)
-- Run: mysql -u root -p < database/schema-clean.sql
-- ============================================================

CREATE DATABASE
IF NOT EXISTS crm_system CHARACTER
SET utf8mb4
COLLATE utf8mb4_unicode_ci;
USE crm_system;

-- ── Roles ────────────────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS roles
(
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR
(100) NOT NULL UNIQUE,
  descripcion TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_nombre
(nombre)
);

INSERT IGNORE
INTO roles
(id, nombre, descripcion) VALUES
(1, 'super_admin', 'Administrador del sistema'),
(2, 'admin', 'Administrador'),
(3, 'admin_rrhh', 'Administrador de Recursos Humanos'),
(4, 'employee', 'Empleado');

-- ── Permisos ─────────────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS permisos
(
  id INT PRIMARY KEY AUTO_INCREMENT,
  modulo VARCHAR
(100) NOT NULL,
  accion VARCHAR
(100) NOT NULL,
  label VARCHAR
(255) NOT NULL,
  UNIQUE KEY unique_modulo_accion
(modulo, accion)
);

INSERT IGNORE
INTO permisos
(modulo, accion, label) VALUES
('RRHH', 'ver', 'Ver Recursos Humanos'),
('RRHH', 'crear', 'Crear Empleado'),
('RRHH', 'editar', 'Editar Empleado'),
('RRHH', 'eliminar', 'Eliminar Empleado'),
('Asistencia', 'ver', 'Ver Asistencia'),
('Asistencia', 'editar', 'Editar Asistencia'),
('Auditoria', 'ver', 'Ver Auditoría'),
('Analitica', 'ver', 'Ver Analítica'),
('Proyectos', 'ver', 'Ver Proyectos'),
('Proyectos', 'crear', 'Crear Proyecto'),
('Proyectos', 'editar', 'Editar Proyecto'),
('Proyectos', 'eliminar', 'Eliminar Proyecto'),
('Ventas', 'ver', 'Ver Ventas'),
('Ventas', 'crear', 'Crear Venta'),
('Ventas', 'editar', 'Editar Venta'),
('Ventas', 'eliminar', 'Eliminar Venta'),
('Finanzas', 'ver', 'Ver Finanzas'),
('Finanzas', 'crear', 'Crear Transacción'),
('Finanzas', 'editar', 'Editar Transacción'),
('Objetivos', 'ver', 'Ver Objetivos'),
('Objetivos', 'crear', 'Crear Objetivo'),
('Objetivos', 'editar', 'Editar Objetivo'),
('Desempeno', 'ver', 'Ver Evaluaciones'),
('Desempeno', 'crear', 'Crear Evaluación'),
('Desempeno', 'editar', 'Editar Evaluación');

-- ── Roles-Permisos ──────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS roles_permisos
(
  role_id INT NOT NULL,
  permiso_id INT NOT NULL,
  PRIMARY KEY
(role_id, permiso_id),
  FOREIGN KEY
(role_id) REFERENCES roles
(id) ON
DELETE CASCADE,
  FOREIGN KEY (permiso_id)
REFERENCES permisos
(id) ON
DELETE CASCADE
);

-- Super Admin: todos los permisos
INSERT IGNORE
INTO roles_permisos
(role_id, permiso_id)
SELECT 1, id
FROM permisos;

-- Admin: casi todos los permisos
INSERT IGNORE
INTO roles_permisos
(role_id, permiso_id)
SELECT 2, id
FROM permisos
WHERE modulo NOT IN ('Auditoria');

-- Admin RRHH: permisos de RRHH y Asistencia
INSERT IGNORE
INTO roles_permisos
(role_id, permiso_id)
SELECT 3, id
FROM permisos
WHERE modulo IN ('RRHH', 'Asistencia');

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS users
(
  id VARCHAR
(36) PRIMARY KEY,
  name VARCHAR
(150) NOT NULL,
  email VARCHAR
(255) NOT NULL UNIQUE,
  password VARCHAR
(255) NOT NULL,
  role_id INT NOT NULL DEFAULT 4,
  employee_id VARCHAR
(36) NULL,
  is_active TINYINT
(1) NOT NULL DEFAULT 1,
  primer_acceso TINYINT
(1) NOT NULL DEFAULT 0,
  temp_password VARCHAR
(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME NULL,
  FOREIGN KEY
(role_id) REFERENCES roles
(id) ON
DELETE RESTRICT,
  INDEX idx_email (email),
  INDEX idx_role_id
(role_id)
);

-- ── Employees ───────────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS employees
(
  id VARCHAR
(36) PRIMARY KEY,
  user_id VARCHAR
(36) NULL,
  name VARCHAR
(150) NOT NULL,
  email VARCHAR
(255) NOT NULL UNIQUE,
  phone VARCHAR
(30) NULL,
  employee_type ENUM
('instructor','developer','administrator','assistant','other') NOT NULL DEFAULT 'other',
  department VARCHAR
(100) NULL,
  position VARCHAR
(100) NULL,
  hire_date DATE NULL,
  status ENUM
('active','inactive','suspended') NOT NULL DEFAULT 'active',
  photo_url VARCHAR
(500) NULL,
  bio TEXT NULL,
  created_by VARCHAR
(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON
UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_type (employee_type),
  INDEX idx_email (email)
);

-- ── Web Analytics ───────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS web_analytics
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_id VARCHAR
(64) NOT NULL,
  user_id VARCHAR
(36) NULL,
  event_type ENUM
('pageview','click','session_start','session_end') NOT NULL,
  path VARCHAR
(500) NULL,
  element VARCHAR
(255) NULL,
  ip VARCHAR
(45) NOT NULL DEFAULT '',
  user_agent TEXT NULL,
  device_type ENUM
('desktop','mobile','tablet') NOT NULL DEFAULT 'desktop',
  referrer VARCHAR
(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session
(session_id),
  INDEX idx_event_type
(event_type),
  INDEX idx_created
(created_at),
  INDEX idx_path
(path
(191))
);

-- ── Audit Logs ──────────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS audit_logs
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR
(36) NULL,
  action VARCHAR
(100) NOT NULL,
  ip VARCHAR
(45) NOT NULL DEFAULT '',
  user_agent TEXT NULL,
  meta JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user
(user_id),
  INDEX idx_action
(action),
  INDEX idx_created
(created_at)
);

-- ── Notificaciones ──────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS notificaciones
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  usuario_id VARCHAR
(36) NOT NULL,
  titulo VARCHAR
(255) NOT NULL,
  mensaje TEXT NULL,
  tipo VARCHAR
(50) NOT NULL DEFAULT 'info',
  enlace VARCHAR
(500) NULL,
  leida TINYINT
(1) NOT NULL DEFAULT 0,
  leida_at DATETIME NULL,
  creado_por VARCHAR
(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_usuario
(usuario_id),
  INDEX idx_leida
(leida),
  FOREIGN KEY
(usuario_id) REFERENCES users
(id) ON
DELETE CASCADE
);

-- ── Eventos Calendario ──────────────────────────────────────
CREATE TABLE
IF NOT EXISTS eventos_calendario
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  titulo VARCHAR
(255) NOT NULL,
  descripcion TEXT NULL,
  fecha_inicio DATETIME NOT NULL,
  fecha_fin DATETIME NOT NULL,
  tipo VARCHAR
(50) NOT NULL DEFAULT 'evento',
  color VARCHAR
(20) NOT NULL DEFAULT '#4f8ef7',
  todo_el_dia TINYINT
(1) NOT NULL DEFAULT 0,
  creado_por VARCHAR
(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON
UPDATE CURRENT_TIMESTAMP,
  INDEX idx_fecha (fecha_inicio),
  FOREIGN KEY
(creado_por) REFERENCES users
(id) ON
DELETE
SET NULL
);

-- ── Asistencia ──────────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS asistencia
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR
(36) NOT NULL,
  fecha DATE NOT NULL,
  hora_entrada TIME NULL,
  hora_salida TIME NULL,
  minutos_trabajo INT NULL,
  estado ENUM
('presente','ausente','permiso','enfermedad') NOT NULL DEFAULT 'presente',
  notas TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON
UPDATE CURRENT_TIMESTAMP,
  INDEX idx_employee_fecha (employee_id, fecha),
  FOREIGN KEY
(employee_id) REFERENCES employees
(id) ON
DELETE CASCADE
);

-- ── Ausencias ───────────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS ausencias
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR
(36) NOT NULL,
  tipo ENUM
('vacacion','permiso','enfermedad','otro') NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  razon TEXT NULL,
  estado ENUM
('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
  aprobada_por VARCHAR
(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_employee
(employee_id),
  INDEX idx_estado
(estado),
  FOREIGN KEY
(employee_id) REFERENCES employees
(id) ON
DELETE CASCADE,
  FOREIGN KEY (aprobada_por)
REFERENCES users
(id) ON
DELETE
SET NULL
);

-- ── Proyectos ───────────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS proyectos
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR
(255) NOT NULL,
  descripcion TEXT NULL,
  logo_url VARCHAR
(500) NULL,
  estado ENUM
('planeacion','activo','pausado','completado','cancelado') NOT NULL DEFAULT 'planeacion',
  fecha_inicio DATE NULL,
  fecha_fin DATE NULL,
  lider_id VARCHAR
(36) NULL,
  presupuesto DECIMAL
(12,2) NULL,
  creado_por VARCHAR
(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON
UPDATE CURRENT_TIMESTAMP,
  INDEX idx_estado (estado),
  FOREIGN KEY
(lider_id) REFERENCES employees
(id) ON
DELETE
SET NULL
,
  FOREIGN KEY
(creado_por) REFERENCES users
(id) ON
DELETE RESTRICT
);

-- ── Tareas ──────────────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS tareas
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  proyecto_id BIGINT NOT NULL,
  titulo VARCHAR
(255) NOT NULL,
  descripcion TEXT NULL,
  estado ENUM
('por_hacer','en_progreso','completada','bloqueada') NOT NULL DEFAULT 'por_hacer',
  prioridad ENUM
('baja','media','alta','critica') NOT NULL DEFAULT 'media',
  asignado_a VARCHAR
(36) NULL,
  fecha_vencimiento DATE NULL,
  fecha_inicio DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON
UPDATE CURRENT_TIMESTAMP,
  INDEX idx_proyecto (proyecto_id),
  INDEX idx_estado (estado),
  FOREIGN KEY
(proyecto_id) REFERENCES proyectos
(id) ON
DELETE CASCADE,
  FOREIGN KEY (asignado_a)
REFERENCES employees
(id) ON
DELETE
SET NULL
);

-- ── Ventas ──────────────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS ventas
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  cliente VARCHAR
(255) NOT NULL,
  monto DECIMAL
(12,2) NOT NULL,
  estado ENUM
('prospecto','negociacion','ganada','perdida') NOT NULL DEFAULT 'prospecto',
  probabilidad INT NULL DEFAULT 0,
  fecha_cierre DATE NULL,
  vendedor_id VARCHAR
(36) NULL,
  notas TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON
UPDATE CURRENT_TIMESTAMP,
  INDEX idx_estado (estado),
  INDEX idx_vendedor (vendedor_id),
  FOREIGN KEY
(vendedor_id) REFERENCES employees
(id) ON
DELETE
SET NULL
);

-- ── Finanzas ────────────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS finanzas
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tipo ENUM
('ingreso','egreso') NOT NULL,
  categoria VARCHAR
(100) NOT NULL,
  monto DECIMAL
(12,2) NOT NULL,
  descripcion TEXT NULL,
  fecha DATE NOT NULL,
  responsable_id VARCHAR
(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tipo
(tipo),
  INDEX idx_categoria
(categoria),
  INDEX idx_fecha
(fecha),
  FOREIGN KEY
(responsable_id) REFERENCES users
(id) ON
DELETE
SET NULL
);

-- ── Evaluaciones ────────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS evaluaciones
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR
(36) NOT NULL,
  evaluador_id VARCHAR
(36) NOT NULL,
  periodo VARCHAR
(50) NOT NULL,
  desempeno INT NULL,
  comportamiento INT NULL,
  conocimientos INT NULL,
  puntaje_total DECIMAL
(5,2) NULL,
  notas TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_employee
(employee_id),
  FOREIGN KEY
(employee_id) REFERENCES employees
(id) ON
DELETE CASCADE,
  FOREIGN KEY (evaluador_id)
REFERENCES users
(id) ON
DELETE RESTRICT
);

-- ── Objetivos ───────────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS objetivos
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR
(36) NOT NULL,
  titulo VARCHAR
(255) NOT NULL,
  descripcion TEXT NULL,
  meta VARCHAR
(255) NOT NULL,
  progreso INT NOT NULL DEFAULT 0,
  estado ENUM
('pendiente','en_progreso','completado','cancelado') NOT NULL DEFAULT 'pendiente',
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON
UPDATE CURRENT_TIMESTAMP,
  INDEX idx_employee (employee_id),
  INDEX idx_estado (estado),
  FOREIGN KEY
(employee_id) REFERENCES employees
(id) ON
DELETE CASCADE
);

-- ── Sessions ─────────────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS sessions
(
  session_id VARCHAR
(128) NOT NULL PRIMARY KEY,
  expires INT
(11) UNSIGNED NOT NULL,
  data MEDIUMTEXT NULL
);

-- ── OTPs ────────────────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS otps
(
  id VARCHAR
(36) PRIMARY KEY,
  user_email VARCHAR
(255) NOT NULL,
  code VARCHAR
(20) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used TINYINT
(1) NOT NULL DEFAULT 0,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email
(user_email),
  INDEX idx_expires
(expires_at)
);

-- ── Login Intentos ──────────────────────────────────────────
CREATE TABLE
IF NOT EXISTS login_intentos
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR
(255) NOT NULL,
  ip VARCHAR
(45) NOT NULL,
  exitoso TINYINT
(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_ip
(email, ip),
  INDEX idx_created
(created_at)
);

-- ── IP Attempts (Rate limiting) ────────────────────────────
CREATE TABLE
IF NOT EXISTS ip_attempts
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  ip VARCHAR
(45) NOT NULL UNIQUE,
  attempts INT NOT NULL DEFAULT 1,
  last_attempt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Default Admin User
-- Email: admin@crm.com
-- Password: Admin1234! (bcrypt hash)
-- ============================================================
INSERT IGNORE
INTO users
(id, name, email, password, role_id, is_active)
VALUES
(UUID
(), 'Administrador', 'admin@crm.com', '$2b$12$BdcwjI6l9x/WoGQc70BVSOSMLRXD9A249cSuUZZhDIXYza5uNDH2O', 1, 1);
