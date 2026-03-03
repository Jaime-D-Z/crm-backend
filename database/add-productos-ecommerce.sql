-- ============================================================
-- MIGRACIÓN: E-COMMERCE - PRODUCTOS Y ANALYTICS
-- Fecha: 2026-03-03
-- Descripción: Añade tablas para gestión de productos y tracking
-- SAFE: No modifica tablas existentes
-- ============================================================

-- ── 1. Tabla de Productos ────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
    id VARCHAR(36) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT NULL,
    precio DECIMAL(12,2) NOT NULL,
    imagen_url VARCHAR(500) NULL,
    categoria VARCHAR(100) NOT NULL DEFAULT 'General',
    stock INTEGER NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    destacado BOOLEAN NOT NULL DEFAULT FALSE,
    orden INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NULL,
    creado_por VARCHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creado_por) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);
CREATE INDEX IF NOT EXISTS idx_productos_destacado ON productos(destacado);
CREATE INDEX IF NOT EXISTS idx_productos_orden ON productos(orden);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_productos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_productos_updated_at ON productos;
CREATE TRIGGER trigger_productos_updated_at
BEFORE UPDATE ON productos
FOR EACH ROW EXECUTE FUNCTION update_productos_updated_at();

-- ── 2. Tabla de Eventos de Productos ─────────────────────────
CREATE TABLE IF NOT EXISTS eventos_productos (
    id BIGSERIAL PRIMARY KEY,
    producto_id VARCHAR(36) NULL,
    tipo_evento VARCHAR(50) NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    ip VARCHAR(45) NOT NULL DEFAULT '',
    user_agent TEXT NULL,
    device_type VARCHAR(50) NOT NULL DEFAULT 'desktop',
    referrer VARCHAR(500) NULL,
    metadata JSONB NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_eventos_prod_producto ON eventos_productos(producto_id);
CREATE INDEX IF NOT EXISTS idx_eventos_prod_tipo ON eventos_productos(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_eventos_prod_session ON eventos_productos(session_id);
CREATE INDEX IF NOT EXISTS idx_eventos_prod_created ON eventos_productos(created_at);

-- ── 3. Añadir permisos para el módulo de Productos ───────────
INSERT INTO permisos (modulo, accion, label) VALUES
('Productos', 'ver', 'Productos > ver'),
('Productos', 'crear', 'Productos > crear'),
('Productos', 'editar', 'Productos > editar'),
('Productos', 'eliminar', 'Productos > eliminar')
ON CONFLICT (modulo, accion) DO NOTHING;

-- Asignar permisos a super_admin y admin
INSERT INTO roles_permisos (role_id, permiso_id)
SELECT 1, id FROM permisos WHERE modulo = 'Productos'
ON CONFLICT (role_id, permiso_id) DO NOTHING;

INSERT INTO roles_permisos (role_id, permiso_id)
SELECT 2, id FROM permisos WHERE modulo = 'Productos'
ON CONFLICT (role_id, permiso_id) DO NOTHING;

-- ── 4. Datos de ejemplo (opcional - comentar en producción) ──
-- INSERT INTO productos (id, nombre, descripcion, precio, categoria, stock, activo, destacado, orden) VALUES
-- ('prod-001', 'Producto Demo 1', 'Descripción del producto demo', 99.99, 'Tecnología', 10, TRUE, TRUE, 1),
-- ('prod-002', 'Producto Demo 2', 'Otro producto de ejemplo', 149.99, 'Servicios', 5, TRUE, FALSE, 2);

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT 'Migración completada exitosamente' AS status;
SELECT COUNT(*) AS total_productos FROM productos;
SELECT COUNT(*) AS total_eventos FROM eventos_productos;
SELECT COUNT(*) AS total_permisos_productos FROM permisos WHERE modulo = 'Productos';
