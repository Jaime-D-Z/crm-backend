"use strict";
const { query } = require("../core/db");
const { v4: uuid } = require("uuid");

// ── Stats: ingresos, egresos, flujo de caja, cuentas por cobrar ──
exports.getStats = async (req, res) => {
  try {
    const mes = req.query.mes || new Date().toISOString().slice(0, 7);
    const rows = await query(
      `
      SELECT
        tipo,
        SUM(CASE WHEN estado != 'anulada' THEN monto ELSE 0 END) AS total,
        SUM(CASE WHEN estado = 'pendiente' THEN monto ELSE 0 END) AS pendiente
      FROM transacciones_financieras
      WHERE to_char(fecha, 'YYYY-MM') = $1
      GROUP BY tipo`,
      [mes],
    );

    let ingresos = 0,
      egresos = 0,
      cuentasxcobrar = 0;
    for (const r of rows) {
      if (r.tipo === "ingreso") {
        ingresos = parseFloat(r.total);
        cuentasxcobrar = parseFloat(r.pendiente);
      }
      if (r.tipo === "egreso") egresos = parseFloat(r.total);
    }

    // Presupuesto ejecutado (egresos vs. budget del mes — si egresos > 0 calculamos %)
    const totalTx = await query(
      `SELECT COUNT(*) AS c FROM transacciones_financieras WHERE to_char(fecha,'YYYY-MM')=$1 AND estado!='anulada'`,
      [mes],
    );

    res.json({
      ok: true,
      stats: {
        ingresos: +ingresos.toFixed(2),
        egresos: +egresos.toFixed(2),
        flujo_caja: +(ingresos - egresos).toFixed(2),
        cuentas_por_cobrar: +cuentasxcobrar.toFixed(2),
        total_transacciones: totalTx[0].c,
      },
    });
  } catch (e) {
    console.error("Finanzas error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── List transacciones con filtros ───────────────────────────────
exports.list = async (req, res) => {
  try {
    const {
      tipo,
      estado,
      categoria,
      desde,
      hasta,
      q,
      limit = 100,
      offset = 0,
    } = req.query;
    let where = ["1=1"];
    const params = [];
    if (q) {
      const idx = params.length + 1;
      where.push(`(tf.concepto ILIKE $${idx} OR tf.referencia ILIKE $${idx})`);
      params.push(`%${q}%`);
    }

    // Process indexed where clauses
    where = where.map((w, i) => {
      if (w === "1=1") return w;
      if (w.includes("?")) {
        return w.replace("?", `$${i}`); // This is simplified, better use explicit counters
      }
      return w;
    });

    // Better way: reconstruct where with $1, $2...
    let whereFinal = ["1=1"];
    let pIdx = 1;
    let finalParams = [];
    if (tipo) { whereFinal.push(`tf.tipo = $${pIdx++}`); finalParams.push(tipo); }
    if (estado) { whereFinal.push(`tf.estado = $${pIdx++}`); finalParams.push(estado); }
    if (categoria) { whereFinal.push(`tf.categoria = $${pIdx++}`); finalParams.push(categoria); }
    if (desde) { whereFinal.push(`tf.fecha >= $${pIdx++}`); finalParams.push(desde); }
    if (hasta) { whereFinal.push(`tf.fecha <= $${pIdx++}`); finalParams.push(hasta); }
    if (q) {
      whereFinal.push(`(tf.concepto ILIKE $${pIdx} OR tf.referencia ILIKE $${pIdx})`);
      finalParams.push(`%${q}%`);
      pIdx++;
    }

    const rows = await query(
      `
      SELECT tf.*, u.name AS registrado_nombre
      FROM transacciones_financieras tf
      LEFT JOIN users u ON u.id = tf.registrado_por
      WHERE ${whereFinal.join(" AND ")}
      ORDER BY tf.fecha DESC, tf.id DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      [...finalParams, parseInt(limit) || 100, parseInt(offset) || 0],
    );

    const totalRowsCount = await query(
      `SELECT COUNT(*) AS c FROM transacciones_financieras tf WHERE ${whereFinal.join(" AND ")}`,
      finalParams,
    );
    res.json({ ok: true, rows, total: totalRowsCount[0].c });
  } catch (e) {
    console.error("Finanzas error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Categorías distintas ──────────────────────────────────────────
exports.getCategorias = async (req, res) => {
  try {
    const rows = await query(
      `SELECT DISTINCT categoria FROM transacciones_financieras ORDER BY categoria`,
    );
    res.json({ ok: true, categorias: rows.map((r) => r.categoria) });
  } catch (e) {
    console.error("Finanzas error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Crear transacción ─────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const {
      tipo,
      concepto,
      categoria,
      monto,
      metodo_pago,
      estado,
      referencia,
      fecha,
      observaciones,
    } = req.body;
    if (!tipo || !concepto || !monto || !fecha)
      return res
        .status(400)
        .json({ error: "tipo, concepto, monto y fecha son requeridos" });
    const resInsert = await query(
      `INSERT INTO transacciones_financieras (tipo, concepto, categoria, monto, metodo_pago, estado, referencia, fecha, registrado_por, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        tipo,
        concepto,
        categoria || "General",
        parseFloat(monto),
        metodo_pago || "transferencia",
        estado || "completada",
        referencia || null,
        fecha,
        req.session.userId,
        observaciones || null,
      ],
    );
    res.json({ ok: true, id: resInsert[0].id, message: "Transacción registrada" });
  } catch (e) {
    console.error("Finanzas error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Actualizar transacción ────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      concepto,
      categoria,
      monto,
      metodo_pago,
      estado,
      referencia,
      fecha,
      observaciones,
    } = req.body;
    await query(
      `UPDATE transacciones_financieras SET concepto=$1, categoria=$2, monto=$3, metodo_pago=$4, estado=$5, referencia=$6, fecha=$7, observaciones=$8 WHERE id=$9`,
      [
        concepto,
        categoria,
        parseFloat(monto),
        metodo_pago,
        estado,
        referencia || null,
        fecha,
        observaciones || null,
        id,
      ],
    );
    res.json({ ok: true, message: "Transacción actualizada" });
  } catch (e) {
    console.error("Finanzas error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Anular transacción ────────────────────────────────────────────
exports.anular = async (req, res) => {
  try {
    const { id } = req.params;
    await query(
      `UPDATE transacciones_financieras SET estado='anulada' WHERE id=$1`,
      [id],
    );
    res.json({ ok: true, message: "Transacción anulada" });
  } catch (e) {
    console.error("Finanzas error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Evolutivo mensual (últimos 12 meses) ─────────────────────────
exports.getEvolutivo = async (req, res) => {
  try {
    const rows = await query(`
      SELECT to_char(fecha,'YYYY-MM') AS mes,
             tipo,
             SUM(CASE WHEN estado != 'anulada' THEN monto ELSE 0 END) AS total
      FROM transacciones_financieras
      WHERE fecha >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY mes, tipo ORDER BY mes`);
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error("Finanzas error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};
