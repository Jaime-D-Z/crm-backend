"use strict";
const { query } = require("../core/db");
const { v4: uuid } = require("uuid");

// ── Stats del mes ─────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const mes = req.query.mes || new Date().toISOString().slice(0, 7);
    const rows = await query(
      `
      SELECT
        COUNT(*)                                                     AS conteo,
        SUM(CASE WHEN estado='cerrada'  THEN 1 ELSE 0 END)          AS cerradas,
        SUM(CASE WHEN estado='perdida'  THEN 1 ELSE 0 END)          AS perdidas,
        SUM(CASE WHEN estado='prospecto' OR estado='negociacion' THEN 1 ELSE 0 END) AS pipeline,
        SUM(CASE WHEN estado='cerrada'  THEN monto ELSE 0 END)      AS totalVentas,
        SUM(CASE WHEN estado='cerrada'  THEN monto ELSE 0 END) / NULLIF(COUNT(CASE WHEN estado='cerrada' THEN 1 END), 0) AS promedio,
        SUM(CASE WHEN estado IN('prospecto','negociacion') THEN monto ELSE 0 END) AS valor_pipeline
      FROM ventas
      WHERE to_char(fecha,'YYYY-MM') = $1`,
      [mes],
    );
    const s = rows[0];
    const tasaCierre =
      s.conteo > 0 ? Math.round((s.cerradas / s.conteo) * 100) : 0;
    res.json({ ok: true, stats: { ...s, tasa_cierre: tasaCierre, mes } });
  } catch (e) {
    console.error("Ventas error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Lista con filtros ─────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const {
      estado,
      desde,
      hasta,
      vendedor_id,
      q,
      limit = 100,
      offset = 0,
    } = req.query;
    let where = ["1=1"];
    const params = [];
    if (estado) {
      where.push(`v.estado=$${params.length + 1}`);
      params.push(estado);
    }
    if (desde) {
      where.push(`v.fecha >= $${params.length + 1}`);
      params.push(desde);
    }
    if (hasta) {
      where.push(`v.fecha <= $${params.length + 1}`);
      params.push(hasta);
    }
    if (vendedor_id) {
      where.push(`v.vendedor_id=$${params.length + 1}`);
      params.push(vendedor_id);
    }
    if (q) {
      const idx = params.length + 1;
      where.push(`(v.cliente_nombre ILIKE $${idx} OR v.concepto ILIKE $${idx})`);
      params.push(`%${q}%`);
    }

    // Safe parsing for limit and offset
    const lim = Math.max(1, parseInt(limit) || 100);
    const off = Math.max(0, parseInt(offset) || 0);

    const rows = await query(
      `
      SELECT v.*, u.name AS vendedor_nombre
      FROM ventas v
      LEFT JOIN users u ON u.id = v.vendedor_id
      WHERE ${where.join(" AND ")}
      ORDER BY v.fecha DESC, v.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, lim, off],
    );
    const total = await query(
      `SELECT COUNT(*) AS c FROM ventas v WHERE ${where.join(" AND ")}`,
      params,
    );
    res.json({ ok: true, rows, total: total[0].c });
  } catch (e) {
    console.error("Ventas error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Crear venta ───────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const {
      cliente_nombre,
      concepto,
      monto,
      fecha,
      estado,
      metodo_pago,
      observaciones,
    } = req.body;
    if (!cliente_nombre || !concepto || !monto || !fecha)
      return res.status(400).json({
        error: "cliente_nombre, concepto, monto y fecha son requeridos",
      });
    const id = uuid();
    await query(
      `INSERT INTO ventas (id, cliente_nombre, concepto, monto, fecha, estado, vendedor_id, metodo_pago, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        cliente_nombre,
        concepto,
        parseFloat(monto),
        fecha,
        estado || "prospecto",
        req.session.userId,
        metodo_pago || "transferencia",
        observaciones || null,
      ],
    );
    res.json({ ok: true, id, message: "Venta registrada" });
  } catch (e) {
    console.error("Ventas error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Actualizar venta completa ─────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      cliente_nombre,
      concepto,
      monto,
      fecha,
      estado,
      metodo_pago,
      observaciones,
    } = req.body;
    await query(
      `UPDATE ventas SET cliente_nombre=$1,concepto=$2,monto=$3,fecha=$4,estado=$5,metodo_pago=$6,observaciones=$7 WHERE id=$8`,
      [
        cliente_nombre,
        concepto,
        parseFloat(monto),
        fecha,
        estado,
        metodo_pago,
        observaciones || null,
        id,
      ],
    );
    res.json({ ok: true, message: "Venta actualizada" });
  } catch (e) {
    console.error("Ventas error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Cambiar estado ────────────────────────────────────────────────
exports.updateEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    await query(`UPDATE ventas SET estado=$1 WHERE id=$2`, [estado, id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("Ventas error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Evolutivo mensual (últimos 6 meses) ──────────────────────────
exports.getEvolutivo = async (req, res) => {
  try {
    const rows = await query(`
      SELECT to_char(fecha,'YYYY-MM') AS mes,
             SUM(CASE WHEN estado='cerrada' THEN monto ELSE 0 END) AS cerradas,
             COUNT(CASE WHEN estado='cerrada' THEN 1 END) AS total_cerradas,
             COUNT(*) AS total
      FROM ventas
      WHERE fecha >= CURRENT_DATE - (INTERVAL '1 month' * 6)
      GROUP BY mes ORDER BY mes`);
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error("Ventas error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Eliminar Venta ───────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`DELETE FROM ventas WHERE id=$1`, [id]);
    // In pg, we check the length of deleted rows if we used RETURNING, 
    // or we can check result if query returned it.
    // Our core/db.js query function returns result.rows.
    // We'll trust the query executed if no error.
    res.json({ ok: true, message: "Venta eliminada" });
  } catch (e) {
    console.error("Ventas remove error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};
