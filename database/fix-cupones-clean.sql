-- ═══════════════════════════════════════════════════════════
-- LIMPIEZA Y RECREACIÓN DE TABLAS DE CUPONES
-- ═══════════════════════════════════════════════════════════

-- Eliminar triggers si existen
DROP TRIGGER IF EXISTS update_suscriptores_updated_at ON suscriptores;
DROP TRIGGER IF EXISTS update_cupones_updated_at ON cupones;

-- Eliminar tablas si existen (en orden correcto por foreign keys)
DROP TABLE IF EXISTS cupones_uso CASCADE;
DROP TABLE IF EXISTS cupones CASCADE;
DROP TABLE IF EXISTS suscriptores CASCADE;

-- Crear tabla de suscriptores
CREATE TABLE suscriptores (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(255),
    ip VARCHAR(100),
    session_id VARCHAR(255),
    origen VARCHAR(50) DEFAULT 'modal_5min',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de cupones
CREATE TABLE cupones (
    id VARCHAR(36) PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    tipo VARCHAR(20) DEFAULT 'porcentaje',
    valor DECIMAL(10, 2) NOT NULL,
    producto_id VARCHAR(36) REFERENCES productos(id) ON DELETE SET NULL,
    email_destinatario VARCHAR(255),
    ip_destinatario VARCHAR(100),
    usos_maximos INTEGER DEFAULT 1,
    usos_actuales INTEGER DEFAULT 0,
    fecha_expiracion TIMESTAMP,
    activo BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de uso de cupones
CREATE TABLE cupones_uso (
    id VARCHAR(36) PRIMARY KEY,
    cupon_id VARCHAR(36) REFERENCES cupones(id) ON DELETE CASCADE,
    pedido_id VARCHAR(36),
    email VARCHAR(255),
    ip VARCHAR(100),
    descuento_aplicado DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices
CREATE INDEX idx_suscriptores_email ON suscriptores(email);
CREATE INDEX idx_suscriptores_ip ON suscriptores(ip);
CREATE INDEX idx_cupones_codigo ON cupones(codigo);
CREATE INDEX idx_cupones_email ON cupones(email_destinatario);
CREATE INDEX idx_cupones_ip ON cupones(ip_destinatario);
CREATE INDEX idx_cupones_activo ON cupones(activo);

-- Crear función para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear triggers
CREATE TRIGGER update_suscriptores_updated_at 
    BEFORE UPDATE ON suscriptores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cupones_updated_at 
    BEFORE UPDATE ON cupones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verificar
SELECT 'Tablas creadas exitosamente' as status;
