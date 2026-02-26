"use strict";
const { query } = require("../core/db");

// ── Resumen del mes ───────────────────────────────────────────────
exports.getResumen = async (req, res) => {
  try {
    const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
    const mes = fecha.slice(0, 7);

    const [diario, mensual] = await Promise.all([
      // Conteo del día solicitado
      query(
        `
        SELECT ar.estado, COUNT(*) AS total
        FROM asistencia_registros ar
        WHERE ar.fecha = $1
        GROUP BY ar.estado`,
        [fecha],
      ),
      // Resumen mensual
      query(
        `
        SELECT ar.estado, COUNT(*) AS total
        FROM asistencia_registros ar
        WHERE to_char(ar.fecha,'YYYY-MM') = $1
        GROUP BY ar.estado`,
        [mes],
      ),
    ]);

    const toMap = (rows) =>
      Object.fromEntries(rows.map((r) => [r.estado, parseInt(r.total)]));
    const presentes = diario.find((d) => d.estado === "presente")?.total || 0;
    const ausentes = diario.find((d) => d.estado === "ausente")?.total || 0;
    const tardanzas = diario.find((d) => d.estado === "tardanza")?.total || 0;

    res.json({
      ok: true,
      resumen: { presentes, ausentes, tardanzas },
      diario: toMap(diario),
      mensual: toMap(mensual),
      fecha,
      mes,
    });
  } catch (e) {
    console.error("Asistencia error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Lista del día o filtro ────────────────────────────────────────
exports.getList = async (req, res) => {
  try {
    const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
    // Traer todos los usuarios activos y cruzar con asistencia de esa fecha
    const rows = await query(
      `
      SELECT u.id AS usuario_id, u.name AS usuario_nombre, u.email, e.position, e.department,
             ar.id AS reg_id, ar.hora_entrada, ar.hora_salida, ar.estado, ar.observaciones
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      LEFT JOIN asistencia_registros ar ON ar.usuario_id = u.id AND ar.fecha = $1
      WHERE u.is_active = TRUE AND u.role IN ('employee','admin','super_admin')
      ORDER BY u.name`,
      [fecha],
    );
    res.json({ ok: true, rows, fecha });
  } catch (e) {
    console.error("Asistencia error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Marcar o actualizar asistencia ───────────────────────────────
exports.marcar = async (req, res) => {
  try {
    const {
      usuario_id,
      fecha,
      hora_entrada,
      hora_salida,
      estado,
      observaciones,
    } = req.body;
    if (!usuario_id || !fecha || !estado)
      return res
        .status(400)
        .json({ error: "usuario_id, fecha y estado son requeridos" });

    // UPSERT: si ya existe, actualiza
    await query(
      `
      INSERT INTO asistencia_registros (usuario_id, fecha, hora_entrada, hora_salida, estado, observaciones, registrado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (usuario_id, fecha) DO UPDATE SET
        hora_entrada = COALESCE(EXCLUDED.hora_entrada, asistencia_registros.hora_entrada),
        hora_salida  = COALESCE(EXCLUDED.hora_salida, asistencia_registros.hora_salida),
        estado       = EXCLUDED.estado,
        observaciones= EXCLUDED.observaciones,
        registrado_por = EXCLUDED.registrado_por,
        updated_at   = CURRENT_TIMESTAMP`,
      [
        usuario_id,
        fecha,
        hora_entrada || null,
        hora_salida || null,
        estado,
        observaciones || null,
        req.session.userId,
      ],
    );
    res.json({ ok: true, message: "Asistencia registrada" });
  } catch (e) {
    console.error("Asistencia error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Marcar entrada (Check-in) ───────────────────────────────────
exports.marcarEntrada = async (req, res) => {
  try {
    const uid = req.session.userId;
    const { hora } = req.body;
    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);
    const horaFinal = hora || now.toTimeString().slice(0, 8);

    // Only allow marking if no entry exists yet
    const existing = await query(
      "SELECT id FROM asistencia_registros WHERE usuario_id = $1 AND fecha = $2",
      [uid, fecha]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: "Ya has registrado tu asistencia hoy." });
    }

    await query(
      `INSERT INTO asistencia_registros (usuario_id, fecha, hora_entrada, estado, registrado_por)
       VALUES ($1, $2, $3, 'presente', $1)`,
      [uid, fecha, horaFinal]
    );

    res.json({ ok: true, message: "Entrada registrada", hora: horaFinal });
  } catch (e) {
    console.error("Asistencia error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Marcar salida (Check-out) ───────────────────────────────────
exports.marcarSalida = async (req, res) => {
  try {
    const uid = req.session.userId;
    const { hora } = req.body;
    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);
    const horaFinal = hora || now.toTimeString().slice(0, 8);

    const result = await query(
      `UPDATE asistencia_registros SET hora_salida = $1, updated_at = CURRENT_TIMESTAMP
       WHERE usuario_id = $2 AND fecha = $3`,
      [horaFinal, uid, fecha]
    );

    if (result.rowCount === 0) {
      // If no entry exists, we create one as present with only salida
      await query(
        `INSERT INTO asistencia_registros (usuario_id, fecha, hora_salida, estado, registrado_por)
         VALUES ($1, $2, $3, 'presente', $1)`,
        [uid, fecha, horaFinal]
      );
    }

    res.json({ ok: true, message: "Salida registrada", hora: horaFinal });
  } catch (e) {
    console.error("Asistencia error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Historial del usuario ─────────────────────────────────────────
exports.getHistorial = async (req, res) => {
  try {
    const uid = req.session.userId;
    const rows = await query(
      `
      SELECT * FROM asistencia_registros
      WHERE usuario_id = $1
      ORDER BY fecha DESC LIMIT 30`,
      [uid],
    );
    res.json({ ok: true, historial: rows });
  } catch (e) {
    console.error("Asistencia error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};
