-- ══════════════════════════════════════════════════════════════
-- TABLAS PARA E-COMMERCE: PEDIDOS Y DETALLES
-- ══════════════════════════════════════════════════════════════

-- ── Tabla de Pedidos (Órdenes de Compra) ─────────────────────
CREATE TABLE IF NOT EXISTS pedidos (
    id VARCHAR(36) PRIMARY KEY,
    numero_orden VARCHAR(50) UNIQUE NOT NULL,
    
    -- Cliente
    cliente_nombre VARCHAR(255) NOT NULL,
    cliente_email VARCHAR(255) NOT NULL,
    cliente_telefono VARCHAR(50),
    
    -- Dirección de envío
    direccion_calle VARCHAR(255),
    direccion_ciudad VARCHAR(100),
    direccion_estado VARCHAR(100),
    direccion_codigo_postal VARCHAR(20),
    direccion_pais VARCHAR(100) DEFAULT 'México',
    
    -- Montos
    subtotal DECIMAL(12,2) NOT NULL,
    impuestos DECIMAL(12,2) DEFAULT 0,
    envio DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    
    -- Estado del pedido
    estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
    -- Estados: pendiente, pagado, procesando, enviado, entregado, cancelado
    
    -- Pago
    metodo_pago VARCHAR(50) NOT NULL,
    -- Métodos: tarjeta_credito, tarjeta_debito, paypal, transferencia, efectivo
    estado_pago VARCHAR(50) NOT NULL DEFAULT 'pendiente',
    -- Estados pago: pendiente, aprobado, rechazado, reembolsado
    
    -- Datos de pago simulado
    tarjeta_ultimos4 VARCHAR(4),
    tarjeta_marca VARCHAR(50),
    transaccion_id VARCHAR(100),
    
    -- Tracking
    session_id VARCHAR(100),
    ip VARCHAR(100),
    user_agent TEXT,
    
    -- Notas
    notas_cliente TEXT,
    notas_internas TEXT,
    
    -- Timestamps
    fecha_pedido TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_pago TIMESTAMP,
    fecha_envio TIMESTAMP,
    fecha_entrega TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Tabla de Detalles de Pedido ──────────────────────────────
CREATE TABLE IF NOT EXISTS pedidos_detalle (
    id VARCHAR(36) PRIMARY KEY,
    pedido_id VARCHAR(36) NOT NULL,
    producto_id VARCHAR(36) NOT NULL,
    
    -- Snapshot del producto al momento de la compra
    producto_nombre VARCHAR(255) NOT NULL,
    producto_descripcion TEXT,
    producto_imagen_url TEXT,
    
    -- Precio y cantidad
    precio_unitario DECIMAL(12,2) NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    subtotal DECIMAL(12,2) NOT NULL,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
);

-- ══════════════════════════════════════════════════════════════
-- ÍNDICES
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado_pago ON pedidos(estado_pago);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_email ON pedidos(cliente_email);
CREATE INDEX IF NOT EXISTS idx_pedidos_numero ON pedidos(numero_orden);

CREATE INDEX IF NOT EXISTS idx_pedidos_detalle_pedido ON pedidos_detalle(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_detalle_producto ON pedidos_detalle(producto_id);

-- ══════════════════════════════════════════════════════════════
-- TRIGGER PARA UPDATED_AT
-- ══════════════════════════════════════════════════════════════

CREATE TRIGGER update_pedidos_updated_at 
BEFORE UPDATE ON pedidos 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════
-- FUNCIÓN PARA GENERAR NÚMERO DE ORDEN
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generar_numero_orden()
RETURNS VARCHAR(50) AS $$
DECLARE
    nuevo_numero VARCHAR(50);
    existe BOOLEAN;
BEGIN
    LOOP
        -- Formato: ORD-YYYYMMDD-XXXX (ej: ORD-20260303-0001)
        nuevo_numero := 'ORD-' || 
                       TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
                       LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
        
        -- Verificar si existe
        SELECT EXISTS(SELECT 1 FROM pedidos WHERE numero_orden = nuevo_numero) INTO existe;
        
        EXIT WHEN NOT existe;
    END LOOP;
    
    RETURN nuevo_numero;
END;
$$ LANGUAGE plpgsql;
