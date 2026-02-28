const { query } = require('../core/db');

// ── GET /api/facial/config ────────────────────────────────
async function getConfig(req, res) {
    try {
        const [config] = await query('SELECT * FROM facial_config ORDER BY id DESC LIMIT 1');
        
        if (!config) {
            // Return default config if none exists
            return res.json({
                ok: true,
                config: {
                    threshold: 60.00,
                    max_attempts: 3,
                    auto_block_enabled: true,
                    notify_admin: true
                }
            });
        }

        res.json({ ok: true, config });
    } catch (err) {
        console.error('getConfig error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── PUT /api/facial/config ────────────────────────────────
async function updateConfig(req, res) {
    try {
        const { threshold, max_attempts, auto_block_enabled, notify_admin } = req.body;
        const userId = req.session.userId;

        // Validate threshold
        if (threshold < 50 || threshold > 99) {
            return res.status(400).json({ error: 'El umbral debe estar entre 50% y 99%' });
        }

        // Update or insert config
        await query(`
            INSERT INTO facial_config (threshold, max_attempts, auto_block_enabled, notify_admin, updated_by, updated_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
                threshold = $1,
                max_attempts = $2,
                auto_block_enabled = $3,
                notify_admin = $4,
                updated_by = $5,
                updated_at = CURRENT_TIMESTAMP
        `, [threshold, max_attempts, auto_block_enabled, notify_admin, userId]);

        res.json({ ok: true, message: 'Configuración actualizada correctamente' });
    } catch (err) {
        console.error('updateConfig error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── GET /api/facial/logs ──────────────────────────────────
async function getLogs(req, res) {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const logs = await query(`
            SELECT 
                id, user_id, user_name, similarity, threshold, status, ip_address, created_at
            FROM facial_recognition_logs
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const [{ total }] = await query('SELECT COUNT(*) as total FROM facial_recognition_logs');

        res.json({ 
            ok: true, 
            logs,
            total: parseInt(total),
            limit,
            offset
        });
    } catch (err) {
        console.error('getLogs error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── GET /api/facial/stats ─────────────────────────────────
async function getStats(req, res) {
    try {
        const [stats] = await query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
                COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked,
                AVG(CASE WHEN status = 'success' THEN similarity END) as avg_similarity
            FROM facial_recognition_logs
            WHERE created_at >= NOW() - INTERVAL '30 days'
        `);

        res.json({ ok: true, stats });
    } catch (err) {
        console.error('getStats error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── Helper: Log facial recognition attempt ────────────────
async function logRecognitionAttempt({ userId, userName, similarity, threshold, status, ipAddress }) {
    try {
        await query(`
            INSERT INTO facial_recognition_logs (user_id, user_name, similarity, threshold, status, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [userId, userName, similarity, threshold, status, ipAddress]);
    } catch (err) {
        console.error('logRecognitionAttempt error:', err);
    }
}

module.exports = {
    getConfig,
    updateConfig,
    getLogs,
    getStats,
    logRecognitionAttempt
};
