-- ═══════════════════════════════════════════════════════════
-- TABLAS: CUPONES Y SUSCRIPTORES
-- ═══════════════════════════════════════════════════════════

-- Tabla de suscriptores
CREATE TABLE IF NOT EXISTS suscriptores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(255),
    ip VARCHAR(100),
    session_id VARCHAR(255),
    origen VARCHAR(50) DEFAULT 'modal_5min', -- modal_5min, manual, checkout
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de cupones de descuento
CREATE TABLE IF NOT EXISTS cupones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    tipo VARCHAR(20) DEFAULT 'porcentaje', -- porcentaje, monto_fijo
    valor DECIMAL(10, 2) NOT NULL, -- 10 para 10%, o monto fijo
    producto_id UUID REFERENCES productos(id) ON DELETE SET NULL, -- NULL = aplica a todos
    email_destinatario VARCHAR(255), -- NULL = público, o email específico
    ip_destinatario VARCHAR(100), -- Para cupones personalizados por IP
    usos_maximos INTEGER DEFAULT 1,
    usos_actuales INTEGER DEFAULT 0,
    fecha_expiracion TIMESTAMP,
    activo BOOLEAN DEFAULT true,
    metadata JSONB, -- Info adicional: producto_nombre, razon, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de uso de cupones (historial)
CREATE TABLE IF NOT EXISTS cupones_uso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cupon_id UUID REFERENCES cupones(id) ON DELETE CASCADE,
    pedido_id UUID, -- Si se integra con pedidos
    email VARCHAR(255),
    ip VARCHAR(100),
    descuento_aplicado DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_suscriptores_email ON suscriptores(email);
CREATE INDEX IF NOT EXISTS idx_suscriptores_ip ON suscriptores(ip);
CREATE INDEX IF NOT EXISTS idx_cupones_codigo ON cupones(codigo);
CREATE INDEX IF NOT EXISTS idx_cupones_email ON cupones(email_destinatario);
CREATE INDEX IF NOT EXISTS idx_cupones_ip ON cupones(ip_destinatario);
CREATE INDEX IF NOT EXISTS idx_cupones_activo ON cupones(activo);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_suscriptores_updated_at BEFORE UPDATE ON suscriptores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cupones_updated_at BEFORE UPDATE ON cupones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verificar creación
SELECT 'Tablas creadas exitosamente' as status;
