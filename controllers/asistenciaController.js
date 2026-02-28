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


// ── Marcar asistencia con reconocimiento facial ──────────────────
exports.marcarConRostro = async (req, res) => {
  try {
    const uid = req.session.userId;
    const { photo_base64, tipo } = req.body; // tipo: 'entrada' o 'salida'

    if (!photo_base64 || !tipo) {
      return res.status(400).json({ error: 'Foto y tipo son requeridos' });
    }

    // Get facial config from database
    const [config] = await query('SELECT threshold FROM facial_config ORDER BY id DESC LIMIT 1');
    const threshold = config ? parseFloat(config.threshold) : 60.0;

    // Get user's stored face descriptor
    const [user] = await query(
      'SELECT id, name, face_descriptor, photo_url FROM users WHERE id = $1',
      [uid]
    );

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!user.face_descriptor) {
      return res.status(400).json({ 
        error: 'No tienes una foto facial registrada. Por favor, actualiza tu perfil con una foto.' 
      });
    }

    // Extract face descriptor from captured photo
    const faceApiService = require('../services/faceApiService');
    const AuditLog = require('../models/AuditLog');
    let capturedDescriptor;
    
    try {
      capturedDescriptor = await faceApiService.getFaceDescriptorFromBase64(photo_base64);
    } catch (err) {
      console.error('Error extracting face descriptor:', err);
      
      // Log failed attempt in facial logs
      const facialConfigCtrl = require('./facialConfigController');
      await facialConfigCtrl.logRecognitionAttempt({
        userId: uid,
        userName: user.name,
        similarity: 0,
        threshold,
        status: 'failed',
        ipAddress: req.ip || req.connection.remoteAddress
      });

      // Log in general audit logs
      await AuditLog.log(uid, 'facial_recognition_failed', req, {
        reason: 'no_face_detected',
        tipo
      });

      return res.status(400).json({ 
        error: 'No se pudo detectar un rostro en la imagen. Asegúrate de que tu cara esté bien iluminada y de frente.' 
      });
    }

    // Compare with stored descriptor
    const storedDescriptor = JSON.parse(user.face_descriptor);
    const comparison = faceApiService.compareFaceDescriptors(storedDescriptor, capturedDescriptor, threshold);

    console.log(`🔍 Face comparison for ${user.name}:`, comparison);

    // Check if faces match
    if (!comparison.match) {
      // Log failed attempt in facial logs
      const facialConfigCtrl = require('./facialConfigController');
      await facialConfigCtrl.logRecognitionAttempt({
        userId: uid,
        userName: user.name,
        similarity: comparison.similarity,
        threshold,
        status: 'failed',
        ipAddress: req.ip || req.connection.remoteAddress
      });

      // Log in general audit logs
      await AuditLog.log(uid, 'facial_recognition_failed', req, {
        similarity: comparison.similarity,
        threshold,
        tipo
      });

      return res.status(403).json({ 
        error: `Rostro no reconocido (similitud: ${comparison.similarity.toFixed(1)}%, mínimo requerido: ${threshold}%)`,
        similarity: comparison.similarity,
        threshold,
        userName: user.name
      });
    }

    // Face matched! Log success in facial logs
    const facialConfigCtrl = require('./facialConfigController');
    await facialConfigCtrl.logRecognitionAttempt({
      userId: uid,
      userName: user.name,
      similarity: comparison.similarity,
      threshold,
      status: 'success',
      ipAddress: req.ip || req.connection.remoteAddress
    });

    // Mark attendance
    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);
    const hora = now.toTimeString().slice(0, 8);

    if (tipo === 'entrada') {
      // Check if already marked
      const existing = await query(
        'SELECT id FROM asistencia_registros WHERE usuario_id = $1 AND fecha = $2',
        [uid, fecha]
      );

      if (existing.length > 0) {
        return res.status(400).json({ error: 'Ya has registrado tu entrada hoy.' });
      }

      await query(
        `INSERT INTO asistencia_registros (usuario_id, fecha, hora_entrada, estado, registrado_por, metodo_registro)
         VALUES ($1, $2, $3, 'presente', $1, 'facial')`,
        [uid, fecha, hora]
      );

      // Log in general audit logs
      await AuditLog.log(uid, 'attendance_facial_checkin', req, {
        similarity: comparison.similarity,
        threshold,
        hora,
        fecha
      });

      res.json({ 
        ok: true, 
        message: `Entrada registrada exitosamente`,
        hora,
        similarity: comparison.similarity,
        threshold,
        userName: user.name,
        metodo: 'facial'
      });
    } else {
      // Mark salida
      const result = await query(
        `UPDATE asistencia_registros 
         SET hora_salida = $1, updated_at = CURRENT_TIMESTAMP, metodo_registro = 'facial'
         WHERE usuario_id = $2 AND fecha = $3`,
        [hora, uid, fecha]
      );

      if (result.rowCount === 0) {
        // If no entry exists, create one with only salida
        await query(
          `INSERT INTO asistencia_registros (usuario_id, fecha, hora_salida, estado, registrado_por, metodo_registro)
           VALUES ($1, $2, $3, 'presente', $1, 'facial')`,
          [uid, fecha, hora]
        );
      }

      // Log in general audit logs
      await AuditLog.log(uid, 'attendance_facial_checkout', req, {
        similarity: comparison.similarity,
        threshold,
        hora,
        fecha
      });

      res.json({ 
        ok: true, 
        message: `Salida registrada exitosamente`,
        hora,
        similarity: comparison.similarity,
        threshold,
        userName: user.name,
        metodo: 'facial'
      });
    }
  } catch (e) {
    console.error('Asistencia facial error:', e);
    res.status(500).json({ error: 'Error del servidor: ' + e.message });
  }
};
