-- Tabla de configuración de reconocimiento facial
CREATE TABLE IF NOT EXISTS facial_config (
    id SERIAL PRIMARY KEY,
    threshold DECIMAL(5,2) NOT NULL DEFAULT 60.00,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    auto_block_enabled BOOLEAN NOT NULL DEFAULT true,
    notify_admin BOOLEAN NOT NULL DEFAULT true,
    updated_by VARCHAR(36) REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar configuración por defecto
INSERT INTO facial_config (threshold, max_attempts, auto_block_enabled, notify_admin)
VALUES (60.00, 3, true, true)
ON CONFLICT DO NOTHING;

-- Tabla de logs de reconocimiento facial
CREATE TABLE IF NOT EXISTS facial_recognition_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(150),
    similarity DECIMAL(5,2),
    threshold DECIMAL(5,2),
    status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'blocked'
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_facial_logs_user ON facial_recognition_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_facial_logs_status ON facial_recognition_logs(status);
CREATE INDEX IF NOT EXISTS idx_facial_logs_created ON facial_recognition_logs(created_at DESC);

COMMENT ON TABLE facial_config IS 'Configuración del sistema de reconocimiento facial';
COMMENT ON TABLE facial_recognition_logs IS 'Logs de intentos de reconocimiento facial';
