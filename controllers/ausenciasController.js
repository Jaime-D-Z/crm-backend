'use strict';
const { query } = require('../core/db');

// POST /api/ausencias
exports.create = async (req, res) => {
    const { tipo, fechaInicio, fechaFin, motivo } = req.body;
    if (!fechaInicio || !fechaFin)
        return res.status(400).json({ error: 'Fechas requeridas' });

    try {
        await query(
            `INSERT INTO permisos_ausencias (usuario_id, tipo, fecha_inicio, fecha_fin, motivo, estado_aprobacion)
       VALUES (?,?,?,?,?,'pendiente')`,
            [req.session.userId, tipo || 'permiso', fechaInicio, fechaFin, motivo || null]
        );
        res.json({ ok: true, message: 'Solicitud registrada' });
    } catch (err) {
        console.error('ausencias.create error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// GET /api/ausencias
exports.getAll = async (req, res) => {
    try {
        const rows = await query(
            `SELECT pa.*, u.name AS usuario_nombre
       FROM permisos_ausencias pa
       LEFT JOIN users u ON u.id = pa.usuario_id
       ORDER BY pa.created_at DESC LIMIT 100`
        );
        res.json({ ok: true, rows });
    } catch (err) {
        console.error('ausencias.getAll error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// PUT /api/ausencias/:id/aprobar
exports.aprobar = async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    try {
        await query(
            `UPDATE permisos_ausencias SET estado_aprobacion='aprobado', aprobador_id=? WHERE id=?`,
            [req.session.userId, id]
        );
        res.json({ ok: true, message: 'Solicitud aprobada' });
    } catch (err) {
        console.error('ausencias.aprobar error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// PUT /api/ausencias/:id/rechazar
exports.rechazar = async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    try {
        await query(
            `UPDATE permisos_ausencias SET estado_aprobacion='rechazado', aprobador_id=? WHERE id=?`,
            [req.session.userId, id]
        );
        res.json({ ok: true, message: 'Solicitud rechazada' });
    } catch (err) {
        console.error('ausencias.rechazar error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};
