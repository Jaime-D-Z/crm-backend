"use strict";
const { query } = require("../core/db");
const { v4: uuid } = require("uuid");

// ── Helper: % tareas completadas por proyecto ─────────────────────
async function calcAvance(proyectoId) {
  const rows = await query(
    `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN estado='completada' THEN 1 ELSE 0 END) AS completadas
    FROM tareas_proyecto WHERE proyecto_id = $1`,
    [proyectoId],
  );
  const { total, completadas } = rows[0];
  return total === 0 ? 0 : Math.round((completadas / total) * 100);
}

// ── Eliminar Proyecto ────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    // Check existence
    const exists = await query(`SELECT id FROM proyectos WHERE id=$1`, [id]);
    if (!exists.length)
      return res.status(404).json({ error: "Proyecto no encontrado" });

    // Delete associated tasks first (or rely on Cascade, but being explicit is safer)
    await query(`DELETE FROM tareas_proyecto WHERE proyecto_id=$1`, [id]);
    await query(`DELETE FROM proyectos WHERE id=$1`, [id]);

    res.json({ ok: true, message: "Proyecto y sus tareas eliminados" });
  } catch (e) {
    console.error("Proyectos remove error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Lista todos los proyectos ────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const { estado } = req.query;
    let where = "1=1";
    const params = [];
    if (estado) {
      where += " AND p.estado = $1";
      params.push(estado);
    }

    const rows = await query(
      `
      SELECT p.*, u.name AS responsable_nombre,
             (SELECT COUNT(*) FROM tareas_proyecto t WHERE t.proyecto_id = p.id) AS total_tareas,
             (SELECT COUNT(*) FROM tareas_proyecto t WHERE t.proyecto_id = p.id AND t.estado='completada') AS tareas_completadas
      FROM proyectos p
      LEFT JOIN users u ON u.id = p.responsable_id
      WHERE ${where}
      ORDER BY p.created_at DESC`,
      params,
    );

    for (const p of rows) {
      p.avance =
        p.total_tareas === 0
          ? 0
          : Math.round((p.tareas_completadas / p.total_tareas) * 100);
    }

    res.json({ ok: true, rows });
  } catch (e) {
    console.error("Proyectos error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Obtener proyecto + tareas ────────────────────────────────────
exports.get = async (req, res) => {
  try {
    const { id } = req.params;
    const [pArr, tareas] = await Promise.all([
      query(
        `SELECT p.*, u.name AS responsable_nombre FROM proyectos p LEFT JOIN users u ON u.id=p.responsable_id WHERE p.id=$1`,
        [id],
      ),
      query(
        `SELECT t.*, u.name AS asignado_nombre FROM tareas_proyecto t LEFT JOIN users u ON u.id=t.asignado_a WHERE t.proyecto_id=$1 ORDER BY t.prioridad DESC, t.created_at`,
        [id],
      ),
    ]);
    if (!pArr.length)
      return res.status(404).json({ error: "Proyecto no encontrado" });
    const proyecto = pArr[0];
    proyecto.avance =
      tareas.length === 0
        ? 0
        : Math.round(
            (tareas.filter((t) => t.estado === "completada").length /
              tareas.length) *
              100,
          );
    res.json({ ok: true, proyecto, tareas });
  } catch (e) {
    console.error("Proyectos error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Crear proyecto ───────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      fecha_inicio,
      fecha_fin,
      presupuesto,
      estado,
      responsable_id,
    } = req.body;
    if (!nombre || !fecha_inicio || !fecha_fin)
      return res
        .status(400)
        .json({ error: "nombre, fecha_inicio, fecha_fin son requeridos" });
    const id = uuid();
    await query(
      `INSERT INTO proyectos (id, nombre, descripcion, fecha_inicio, fecha_fin, presupuesto, estado, responsable_id, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        nombre,
        descripcion || null,
        fecha_inicio,
        fecha_fin,
        presupuesto || null,
        estado || "planificacion",
        responsable_id || null,
        req.session.userId,
      ],
    );
    res.json({ ok: true, id, message: "Proyecto creado" });
  } catch (e) {
    console.error("Proyectos error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Actualizar proyecto ──────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      descripcion,
      fecha_inicio,
      fecha_fin,
      presupuesto,
      estado,
      responsable_id,
    } = req.body;
    await query(
      `UPDATE proyectos SET nombre=$1,descripcion=$2,fecha_inicio=$3,fecha_fin=$4,presupuesto=$5,estado=$6,responsable_id=$7 WHERE id=$8`,
      [
        nombre,
        descripcion || null,
        fecha_inicio,
        fecha_fin,
        presupuesto || null,
        estado,
        responsable_id || null,
        id,
      ],
    );
    res.json({ ok: true, message: "Proyecto actualizado" });
  } catch (e) {
    console.error("Proyectos error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Crear tarea en proyecto ──────────────────────────────────────
exports.createTarea = async (req, res) => {
  try {
    const { id: proyecto_id } = req.params;
    const { titulo, descripcion, asignado_a, prioridad, estado, fecha_limite } =
      req.body;
    if (!titulo) return res.status(400).json({ error: "Título requerido" });
    const tid = uuid();
    await query(
      `INSERT INTO tareas_proyecto (id, proyecto_id, titulo, descripcion, asignado_a, prioridad, estado, fecha_limite)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        tid,
        proyecto_id,
        titulo,
        descripcion || null,
        asignado_a || null,
        prioridad || "media",
        estado || "pendiente",
        fecha_limite || null,
      ],
    );
    res.json({ ok: true, id: tid, message: "Tarea creada" });
  } catch (e) {
    console.error("Proyectos error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Cambiar estado tarea ─────────────────────────────────────────
exports.updateTareaEstado = async (req, res) => {
  try {
    const { tareaId } = req.params;
    const { estado } = req.body;
    await query(`UPDATE tareas_proyecto SET estado=$1 WHERE id=$2`, [
      estado,
      tareaId,
    ]);
    res.json({ ok: true, message: "Estado actualizado" });
  } catch (e) {
    console.error("Proyectos error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Obtener tareas del empleado actual ───────────────────────────
exports.getMyTasks = async (req, res) => {
  try {
    const userId = req.session.userId;
    const tareas = await query(
      `SELECT t.*, p.nombre AS proyecto_nombre, p.id AS proyecto_id
       FROM tareas_proyecto t
       LEFT JOIN proyectos p ON p.id = t.proyecto_id
       WHERE t.asignado_a = $1
       ORDER BY t.prioridad DESC, t.fecha_limite ASC`,
      [userId],
    );
    res.json({ ok: true, tareas });
  } catch (e) {
    console.error("Proyectos getMyTasks error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Stats resumen ────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [total, activos, completados, tareasHoy] = await Promise.all([
      query(`SELECT COUNT(*) AS c FROM proyectos`),
      query(
        `SELECT COUNT(*) AS c FROM proyectos WHERE estado IN ('activo', 'en_progreso')`,
      ),
      query(`SELECT COUNT(*) AS c FROM proyectos WHERE estado='completado'`),
      query(
        `SELECT COUNT(*) AS c FROM tareas_proyecto WHERE fecha_limite=CURRENT_DATE AND estado!='completada'`,
      ),
    ]);
    res.json({
      ok: true,
      stats: {
        total: total[0].c,
        enProgreso: activos[0].c,
        completados: completados[0].c,
        tareas_vencen_hoy: tareasHoy[0].c,
      },
    });
  } catch (e) {
    console.error("Proyectos error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};
