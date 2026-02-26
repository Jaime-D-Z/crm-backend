'use strict';
const { query } = require('../core/db');

// ── Eventos del mes ───────────────────────────────────────────────
exports.getByMes = async (req, res) => {
    try {
        const year = req.query.year || new Date().getFullYear();
        const month = req.query.month || (new Date().getMonth() + 1);
        const rows = await query(`
      SELECT ec.*, u.name AS creado_por_nombre
      FROM eventos_calendario ec
      LEFT JOIN users u ON u.id = ec.creado_por
      WHERE EXTRACT(YEAR FROM ec.fecha_inicio) = $1 AND EXTRACT(MONTH FROM ec.fecha_inicio) = $2
      ORDER BY ec.fecha_inicio`, [parseInt(year), parseInt(month)]);
        res.json({ ok: true, eventos: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Próximos eventos (7 días) ─────────────────────────────────────
exports.getProximos = async (req, res) => {
    try {
        const rows = await query(`
      SELECT ec.*, u.name AS creado_por_nombre
      FROM eventos_calendario ec
      LEFT JOIN users u ON u.id = ec.creado_por
      WHERE ec.fecha_inicio BETWEEN CURRENT_TIMESTAMP AND (CURRENT_TIMESTAMP + INTERVAL '7 days')
      ORDER BY ec.fecha_inicio LIMIT 10`);
        res.json({ ok: true, eventos: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Crear evento ──────────────────────────────────────────────────
exports.create = async (req, res) => {
    try {
        const { titulo, descripcion, fecha_inicio, fecha_fin, tipo, color, todo_el_dia } = req.body;
        if (!titulo || !fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'Título, fecha inicio y fin son requeridos' });
        const r = await query(
            `INSERT INTO eventos_calendario (titulo, descripcion, fecha_inicio, fecha_fin, tipo, color, todo_el_dia, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            [titulo, descripcion || null, fecha_inicio, fecha_fin, tipo || 'evento', color || '#4f8ef7', todo_el_dia ? true : false, req.session.userId]
        );
        res.json({ ok: true, id: r[0].id, message: 'Evento creado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Actualizar evento ─────────────────────────────────────────────
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { titulo, descripcion, fecha_inicio, fecha_fin, tipo, color, todo_el_dia } = req.body;
        await query(
            `UPDATE eventos_calendario SET titulo=$1, descripcion=$2, fecha_inicio=$3, fecha_fin=$4, tipo=$5, color=$6, todo_el_dia=$7 WHERE id=$8`,
            [titulo, descripcion || null, fecha_inicio, fecha_fin, tipo, color, todo_el_dia ? true : false, id]
        );
        res.json({ ok: true, message: 'Evento actualizado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Eliminar evento ───────────────────────────────────────────────
exports.remove = async (req, res) => {
    try {
        await query(`DELETE FROM eventos_calendario WHERE id=$1`, [req.params.id]);
        res.json({ ok: true, message: 'Evento eliminado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
