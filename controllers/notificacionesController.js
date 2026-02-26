'use strict';
const { query } = require('../core/db');

// ── Mis notificaciones ────────────────────────────────────────────
exports.getMias = async (req, res) => {
    try {
        const uid = req.session.userId;
        const rows = await query(`
      SELECT n.*, u.name AS creado_por_nombre
      FROM notificaciones n
      LEFT JOIN users u ON u.id = n.creado_por
      WHERE n.usuario_id = ?
      ORDER BY n.created_at DESC LIMIT 50`, [uid]);
        const noLeidas = rows.filter(r => !r.leida).length;
        res.json({ ok: true, notificaciones: rows, no_leidas: noLeidas });
    } catch (e) {
        console.error('Notificaciones error:', e);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// ── Todas (admin) ─────────────────────────────────────────────────
exports.getAll = async (req, res) => {
    try {
        const rows = await query(`
      SELECT n.*, u.name AS usuario_nombre, c.name AS creado_por_nombre
      FROM notificaciones n
      LEFT JOIN users u ON u.id = n.usuario_id
      LEFT JOIN users c ON c.id = n.creado_por
      ORDER BY n.created_at DESC LIMIT 200`);
        res.json({ ok: true, notificaciones: rows });
    } catch (e) {
        console.error('Notificaciones error:', e);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// ── Badge count (no leídas del usuario) ──────────────────────────
exports.getBadge = async (req, res) => {
    try {
        const uid = req.session.userId;
        const r = await query(`SELECT COUNT(*) AS c FROM notificaciones WHERE usuario_id=? AND leida=0`, [uid]);
        res.json({ ok: true, count: r[0].c });
    } catch (e) {
        console.error('Notificaciones error:', e);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// ── Crear notificación (admin → usuario) ─────────────────────────
exports.create = async (req, res) => {
    try {
        const { usuario_id, titulo, mensaje, tipo, enlace, todos } = req.body;
        if (!titulo) return res.status(400).json({ error: 'Título requerido' });

        if (todos) {
            // Enviar a todos los usuarios activos
            const users = await query(`SELECT id FROM users WHERE is_active=1`);
            for (const u of users) {
                await query(
                    `INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, enlace, creado_por) VALUES (?,?,?,?,?,?)`,
                    [u.id, titulo, mensaje || null, tipo || 'info', enlace || null, req.session.userId]
                );
            }
            return res.json({ ok: true, message: `Enviado a ${users.length} usuarios` });
        }

        if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
        await query(
            `INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, enlace, creado_por) VALUES (?,?,?,?,?,?)`,
            [usuario_id, titulo, mensaje || null, tipo || 'info', enlace || null, req.session.userId]
        );
        res.json({ ok: true, message: 'Notificación enviada' });
    } catch (e) {
        console.error('Notificaciones error:', e);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// ── Marcar leída ──────────────────────────────────────────────────
exports.marcarLeida = async (req, res) => {
    try {
        const { id } = req.params;
        const uid = req.session.userId;
        await query(`UPDATE notificaciones SET leida=1, leida_at=NOW() WHERE id=? AND usuario_id=?`, [id, uid]);
        res.json({ ok: true });
    } catch (e) {
        console.error('Notificaciones error:', e);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// ── Marcar todas leídas ───────────────────────────────────────────
exports.marcarTodasLeidas = async (req, res) => {
    try {
        const uid = req.session.userId;
        await query(`UPDATE notificaciones SET leida=1, leida_at=NOW() WHERE usuario_id=? AND leida=0`, [uid]);
        res.json({ ok: true, message: 'Todas marcadas como leídas' });
    } catch (e) {
        console.error('Notificaciones error:', e);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// ── Eliminar notificación ─────────────────────────────────────────
exports.eliminar = async (req, res) => {
    try {
        const { id } = req.params;
        const uid = req.session.userId;
        // Fix BOLA: Ensure usuario_id = uid
        await query(`DELETE FROM notificaciones WHERE id=? AND usuario_id=?`, [id, uid]);
        res.json({ ok: true });
    } catch (e) {
        console.error('Notificaciones error:', e);
        res.status(500).json({ error: 'Error del servidor' });
    }
};
