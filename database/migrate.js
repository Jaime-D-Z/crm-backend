/**
 * DATABASE MIGRATION V2 — Incremental (safe to run on existing DB)
 * Adds new tables/columns without touching existing data.
 * Run: node database/migrate.js
 */
require('dotenv').config();
const { query, verifyConnection } = require('../core/db');

async function run() {
  await verifyConnection();
  console.log('\n📦 Running CRM V2 migration...\n');

  // ── 1. Roles table ─────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS roles (
      id          INT          PRIMARY KEY AUTO_INCREMENT,
      nombre      VARCHAR(50)  NOT NULL UNIQUE,
      descripcion VARCHAR(200) NULL,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: roles');

  // ── 2. Permisos table ───────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS permisos (
      id      INT          PRIMARY KEY AUTO_INCREMENT,
      modulo  VARCHAR(50)  NOT NULL,
      accion  VARCHAR(50)  NOT NULL,
      label   VARCHAR(100) NULL,
      UNIQUE KEY uq_modulo_accion (modulo, accion)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: permisos');

  // ── 3. Roles_permisos pivot ─────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS roles_permisos (
      role_id    INT NOT NULL,
      permiso_id INT NOT NULL,
      PRIMARY KEY (role_id, permiso_id),
      FOREIGN KEY (role_id)    REFERENCES roles(id)   ON DELETE CASCADE,
      FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: roles_permisos');

  // ── 4. Login intentos ───────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS login_intentos (
      id             BIGINT      PRIMARY KEY AUTO_INCREMENT,
      ip             VARCHAR(45) NOT NULL,
      email          VARCHAR(255) NULL,
      intentos       INT          NOT NULL DEFAULT 0,
      bloqueado_hasta DATETIME    NULL,
      ultimo_intento DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ip_email (ip, email(191))
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: login_intentos');

  // ── 5. Evaluaciones desempeño ───────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS evaluaciones_desempeno (
      id           VARCHAR(36) PRIMARY KEY,
      employee_id  VARCHAR(36) NOT NULL,
      evaluador_id VARCHAR(36) NOT NULL,
      puntaje      TINYINT     NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
      comentario   TEXT        NULL,
      fecha        DATE        NOT NULL,
      created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_emp (employee_id),
      INDEX idx_fecha (fecha)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: evaluaciones_desempeno');

  // ── 6. Objetivos ────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS objetivos (
      id           VARCHAR(36) PRIMARY KEY,
      employee_id  VARCHAR(36) NOT NULL,
      admin_id     VARCHAR(36) NOT NULL,
      titulo       VARCHAR(200) NOT NULL,
      descripcion  TEXT         NULL,
      fecha_limite DATE         NOT NULL,
      avance       TINYINT      NOT NULL DEFAULT 0,
      estado       ENUM('pendiente','en_progreso','completado','vencido') NOT NULL DEFAULT 'pendiente',
      created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_emp    (employee_id),
      INDEX idx_estado (estado)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: objetivos');

  // ── 7. Registro de auditoría (Duplicidad) ───────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS registro_auditoria (
      id              BIGINT      PRIMARY KEY AUTO_INCREMENT,
      admin_id        VARCHAR(36) NOT NULL,
      nombre_nuevo    VARCHAR(150) NOT NULL,
      email_nuevo     VARCHAR(255) NOT NULL,
      nombre_similar  VARCHAR(150) NULL,
      email_similar   VARCHAR(255) NULL,
      similitud       DECIMAL(5,2) NOT NULL,
      accion          ENUM('bloqueado','advertencia_aceptada','advertencia_cancelada') NOT NULL,
      created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fecha  (created_at),
      INDEX idx_admin  (admin_id),
      INDEX idx_simil  (similitud)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: registro_auditoria');

  // ── 8. Columns on users ─────────────────────────────────────
  const userCols = await query(`SHOW COLUMNS FROM users`);
  const colNames = userCols.map(c => c.Field);

  if (!colNames.includes('role_id')) {
    await query(`ALTER TABLE users ADD COLUMN role_id INT NULL AFTER role`);
    await query(`ALTER TABLE users ADD FOREIGN KEY fk_user_role (role_id) REFERENCES roles(id) ON DELETE SET NULL`);
    console.log('✔ Column: users.role_id');
  }
  if (!colNames.includes('primer_acceso')) {
    await query(`ALTER TABLE users ADD COLUMN primer_acceso TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active`);
    console.log('✔ Column: users.primer_acceso');
  }
  if (!colNames.includes('temp_password')) {
    await query(`ALTER TABLE users ADD COLUMN temp_password VARCHAR(255) NULL AFTER primer_acceso`);
    console.log('✔ Column: users.temp_password');
  }
  if (!colNames.includes('refresh_token')) {
    await query(`ALTER TABLE users ADD COLUMN refresh_token VARCHAR(512) NULL`);
    console.log('✔ Column: users.refresh_token');
  }

  // ── 9. Columns on employees ──────────────────────────────────
  const empCols = await query(`SHOW COLUMNS FROM employees`);
  const empColNames = empCols.map(c => c.Field);

  if (!empColNames.includes('photo_url')) {
    await query(`ALTER TABLE employees ADD COLUMN photo_url VARCHAR(500) NULL AFTER bio`);
    console.log('✔ Column: employees.photo_url');
  }

  // ── 10. Permisos ausencias ───────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS permisos_ausencias (
      id                  BIGINT       PRIMARY KEY AUTO_INCREMENT,
      usuario_id          VARCHAR(36)  NOT NULL,
      tipo                ENUM('permiso','vacaciones','ausencia_justificada') NOT NULL DEFAULT 'permiso',
      fecha_inicio        DATE         NOT NULL,
      fecha_fin           DATE         NOT NULL,
      motivo              TEXT         NULL,
      estado_aprobacion   ENUM('pendiente','aprobado','rechazado') NOT NULL DEFAULT 'pendiente',
      aprobador_id        VARCHAR(36)  NULL,
      observaciones       TEXT         NULL,
      created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_usuario   (usuario_id),
      INDEX idx_estado    (estado_aprobacion),
      INDEX idx_tipo      (tipo),
      INDEX idx_fecha     (fecha_inicio, fecha_fin)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: permisos_ausencias');

  // ── 11. Finanzas ─────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS transacciones_financieras (
      id              BIGINT        PRIMARY KEY AUTO_INCREMENT,
      tipo            ENUM('ingreso','egreso') NOT NULL,
      concepto        VARCHAR(200)  NOT NULL,
      categoria       VARCHAR(100)  NOT NULL DEFAULT 'General',
      monto           DECIMAL(12,2) NOT NULL,
      metodo_pago     ENUM('transferencia','efectivo','tarjeta','cheque','otro') NOT NULL DEFAULT 'transferencia',
      estado          ENUM('completada','pendiente','anulada') NOT NULL DEFAULT 'completada',
      referencia      VARCHAR(100)  NULL,
      fecha           DATE          NOT NULL,
      registrado_por  VARCHAR(36)   NOT NULL,
      observaciones   TEXT          NULL,
      created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tipo    (tipo),
      INDEX idx_estado  (estado),
      INDEX idx_fecha   (fecha),
      INDEX idx_reg     (registrado_por)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: transacciones_financieras');

  // ── 12. Notificaciones ───────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS notificaciones (
      id          BIGINT        PRIMARY KEY AUTO_INCREMENT,
      usuario_id  VARCHAR(36)   NOT NULL,
      titulo      VARCHAR(200)  NOT NULL,
      mensaje     TEXT          NULL,
      tipo        ENUM('info','success','warning','error') NOT NULL DEFAULT 'info',
      leida       TINYINT(1)    NOT NULL DEFAULT 0,
      enlace      VARCHAR(500)  NULL,
      creado_por  VARCHAR(36)   NULL,
      leida_at    DATETIME      NULL,
      created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_usuario (usuario_id),
      INDEX idx_leida   (leida),
      INDEX idx_created (created_at)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: notificaciones');

  // ── 13. Calendario ───────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS eventos_calendario (
      id            BIGINT        PRIMARY KEY AUTO_INCREMENT,
      titulo        VARCHAR(200)  NOT NULL,
      descripcion   TEXT          NULL,
      fecha_inicio  DATETIME      NOT NULL,
      fecha_fin     DATETIME      NOT NULL,
      tipo          ENUM('reunion','capacitacion','evento','recordatorio','otro') NOT NULL DEFAULT 'evento',
      color         VARCHAR(20)   NOT NULL DEFAULT '#4f8ef7',
      todo_el_dia   TINYINT(1)    NOT NULL DEFAULT 0,
      creado_por    VARCHAR(36)   NOT NULL,
      created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fecha  (fecha_inicio),
      INDEX idx_tipo   (tipo)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: eventos_calendario');

  // ── 14. Asistencia ───────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS asistencia_registros (
      id              BIGINT        PRIMARY KEY AUTO_INCREMENT,
      usuario_id      VARCHAR(36)   NOT NULL,
      fecha           DATE          NOT NULL,
      hora_entrada    TIME          NULL,
      hora_salida     TIME          NULL,
      estado          ENUM('presente','ausente','tardanza','permiso','feriado') NOT NULL DEFAULT 'ausente',
      observaciones   TEXT          NULL,
      registrado_por  VARCHAR(36)   NULL,
      created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_fecha (usuario_id, fecha),
      INDEX idx_fecha   (fecha),
      INDEX idx_usuario (usuario_id),
      INDEX idx_estado  (estado)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: asistencia_registros');

  // ── 15. Proyectos ────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS proyectos (
      id              VARCHAR(36)   PRIMARY KEY,
      nombre          VARCHAR(200)  NOT NULL,
      descripcion     TEXT          NULL,
      fecha_inicio    DATE          NOT NULL,
      fecha_fin       DATE          NOT NULL,
      presupuesto     DECIMAL(12,2) NULL,
      estado          ENUM('planificacion','activo','pausado','completado','cancelado') NOT NULL DEFAULT 'planificacion',
      responsable_id  VARCHAR(36)   NULL,
      created_by      VARCHAR(36)   NOT NULL,
      created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_estado (estado),
      INDEX idx_resp   (responsable_id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: proyectos');

  await query(`
    CREATE TABLE IF NOT EXISTS tareas_proyecto (
      id            VARCHAR(36)   PRIMARY KEY,
      proyecto_id   VARCHAR(36)   NOT NULL,
      titulo        VARCHAR(200)  NOT NULL,
      descripcion   TEXT          NULL,
      asignado_a    VARCHAR(36)   NULL,
      prioridad     ENUM('baja','media','alta','critica') NOT NULL DEFAULT 'media',
      estado        ENUM('pendiente','en_progreso','revision','completada') NOT NULL DEFAULT 'pendiente',
      fecha_limite  DATE          NULL,
      created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
      INDEX idx_proyecto (proyecto_id),
      INDEX idx_estado   (estado),
      INDEX idx_asignado (asignado_a)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: tareas_proyecto');

  // ── 16. Ventas ───────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS ventas (
      id              VARCHAR(36)   PRIMARY KEY,
      cliente_nombre  VARCHAR(200)  NOT NULL,
      concepto        VARCHAR(300)  NOT NULL,
      monto           DECIMAL(12,2) NOT NULL,
      fecha           DATE          NOT NULL,
      estado          ENUM('prospecto','negociacion','cerrada','perdida','cancelada') NOT NULL DEFAULT 'prospecto',
      vendedor_id     VARCHAR(36)   NULL,
      metodo_pago     ENUM('transferencia','efectivo','tarjeta','otro') NOT NULL DEFAULT 'transferencia',
      observaciones   TEXT          NULL,
      created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_estado   (estado),
      INDEX idx_fecha    (fecha),
      INDEX idx_vendedor (vendedor_id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: ventas');

  // ── 17. Configuración Global ─────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS config_global (
      key_name      VARCHAR(100) PRIMARY KEY,
      value_content TEXT         NOT NULL,
      description   VARCHAR(255) NULL,
      updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✔ Table: config_global');

  console.log('\n✅ Migration complete!\n');
  return true;
}

run()
  .then(() => process.exit(0))
  .catch(err => { console.error('Migration failed:', err.message); process.exit(1); });
