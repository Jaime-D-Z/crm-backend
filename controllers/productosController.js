"use strict";
const { query } = require("../core/db");
const { v4: uuid } = require("uuid");

// ══════════════════════════════════════════════════════════════
// ENDPOINTS PÚBLICOS (Sin autenticación)
// ══════════════════════════════════════════════════════════════

// ── Lista productos activos con recomendaciones personalizadas ───────
exports.listPublic = async (req, res) => {
  try {
    const { categoria, destacado, limit = 50 } = req.query;
    
    // Obtener IP del usuario para recomendaciones personalizadas
    const userIp = req.ip || req.connection.remoteAddress || "";
    
    let where = ["activo = true"];
    const params = [];

    if (categoria) {
      params.push(categoria);
      where.push(`categoria = ${params.length}`);
    }

    if (destacado === "true") {
      where.push("destacado = true");
    }

    params.push(parseInt(limit) || 50);

    // Obtener productos con score de recomendación basado en el comportamiento del usuario
    const rows = await query(
      `WITH user_interactions AS (
        SELECT 
          producto_id,
          COUNT(*) as vistas,
          COUNT(CASE WHEN tipo_evento = 'producto_detalle' THEN 1 END) as detalles,
          MAX(created_at) as ultima_vista
        FROM eventos_productos
        WHERE ip = $${params.length + 1}
          AND producto_id IS NOT NULL
          AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY producto_id
      )
      SELECT 
        p.id, p.nombre, p.descripcion, p.precio, p.imagen_url, p.categoria, 
        p.destacado, p.orden, p.created_at,
        COALESCE(ui.vistas, 0) as user_vistas,
        COALESCE(ui.detalles, 0) as user_detalles,
        ui.ultima_vista,
        COALESCE((ui.vistas * 10 + ui.detalles * 20), 0) as recommendation_score
      FROM productos p
      LEFT JOIN user_interactions ui ON ui.producto_id = p.id
      WHERE ${where.join(" AND ")}
      ORDER BY 
        recommendation_score DESC,
        p.destacado DESC,
        p.orden ASC,
        p.created_at DESC
      LIMIT ${params.length}`,
      [...params, userIp]
    );

    res.json({ 
      ok: true, 
      productos: rows,
      personalized: rows.some(p => p.recommendation_score > 0)
    });
  } catch (e) {
    console.error("Productos public error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Detalle de producto público ──────────────────────────────
exports.getPublic = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query(
      `SELECT id, nombre, descripcion, precio, imagen_url, categoria, 
              destacado, created_at
       FROM productos
       WHERE id = $1 AND activo = true`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ ok: true, producto: rows[0] });
  } catch (e) {
    console.error("Producto public error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ══════════════════════════════════════════════════════════════
// ENDPOINTS ADMIN (Con autenticación)
// ══════════════════════════════════════════════════════════════

// ── Lista todos los productos (admin) ─────────────────────────
exports.list = async (req, res) => {
  try {
    const { categoria, activo, q, limit = 100, offset = 0 } = req.query;
    
    let where = ["1=1"];
    const params = [];

    if (categoria) {
      params.push(categoria);
      where.push(`p.categoria = ${params.length}`);
    }

    if (activo !== undefined) {
      params.push(activo === "true");
      where.push(`p.activo = ${params.length}`);
    }

    if (q) {
      params.push(`%${q}%`);
      where.push(`(p.nombre ILIKE ${params.length} OR p.descripcion ILIKE ${params.length})`);
    }

    const lim = Math.max(1, parseInt(limit) || 100);
    const off = Math.max(0, parseInt(offset) || 0);

    params.push(lim, off);

    const rows = await query(
      `SELECT p.*, u.name AS creador_nombre
       FROM productos p
       LEFT JOIN users u ON u.id = p.creado_por
       WHERE ${where.join(" AND ")}
       ORDER BY p.orden ASC, p.created_at DESC
       LIMIT ${params.length - 1} OFFSET ${params.length}`,
      params
    );

    const total = await query(
      `SELECT COUNT(*) AS c FROM productos p WHERE ${where.join(" AND ")}`,
      params.slice(0, -2)
    );

    res.json({ ok: true, productos: rows, total: parseInt(total[0].c) });
  } catch (e) {
    console.error("Productos list error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Obtener producto por ID (admin) ───────────────────────────
exports.get = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query(
      `SELECT p.*, u.name AS creador_nombre
       FROM productos p
       LEFT JOIN users u ON u.id = p.creado_por
       WHERE p.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ ok: true, producto: rows[0] });
  } catch (e) {
    console.error("Producto get error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Crear producto ────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      precio,
      imagen_url,
      categoria,
      stock,
      activo,
      destacado,
      orden,
      metadata
    } = req.body;

    if (!nombre || !precio) {
      return res.status(400).json({
        error: "nombre y precio son requeridos"
      });
    }

    const id = uuid();
    await query(
      `INSERT INTO productos 
       (id, nombre, descripcion, precio, imagen_url, categoria, stock, 
        activo, destacado, orden, metadata, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        nombre,
        descripcion || null,
        parseFloat(precio),
        imagen_url || null,
        categoria || "General",
        parseInt(stock) || 0,
        activo !== false,
        destacado === true,
        parseInt(orden) || 0,
        metadata ? JSON.stringify(metadata) : null,
        req.session.userId
      ]
    );

    res.json({ ok: true, id, message: "Producto creado exitosamente" });
  } catch (e) {
    console.error("Producto create error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Actualizar producto ───────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      descripcion,
      precio,
      imagen_url,
      categoria,
      stock,
      activo,
      destacado,
      orden,
      metadata
    } = req.body;

    await query(
      `UPDATE productos 
       SET nombre = $1, descripcion = $2, precio = $3, imagen_url = $4,
           categoria = $5, stock = $6, activo = $7, destacado = $8,
           orden = $9, metadata = $10
       WHERE id = $11`,
      [
        nombre,
        descripcion || null,
        parseFloat(precio),
        imagen_url || null,
        categoria || "General",
        parseInt(stock) || 0,
        activo !== false,
        destacado === true,
        parseInt(orden) || 0,
        metadata ? JSON.stringify(metadata) : null,
        id
      ]
    );

    res.json({ ok: true, message: "Producto actualizado exitosamente" });
  } catch (e) {
    console.error("Producto update error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Eliminar producto ─────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si tiene eventos asociados
    const eventos = await query(
      `SELECT COUNT(*) as c FROM eventos_productos WHERE producto_id = $1`,
      [id]
    );

    if (parseInt(eventos[0].c) > 0) {
      // Si tiene eventos, solo desactivar
      await query(`UPDATE productos SET activo = false WHERE id = $1`, [id]);
      return res.json({ 
        ok: true, 
        message: "Producto desactivado (tiene eventos asociados)" 
      });
    }

    // Si no tiene eventos, eliminar
    await query(`DELETE FROM productos WHERE id = $1`, [id]);
    res.json({ ok: true, message: "Producto eliminado exitosamente" });
  } catch (e) {
    console.error("Producto remove error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Estadísticas de productos ─────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN activo = true THEN 1 END) as activos,
        COUNT(CASE WHEN activo = false THEN 1 END) as inactivos,
        COUNT(CASE WHEN destacado = true THEN 1 END) as destacados,
        COUNT(DISTINCT categoria) as categorias,
        SUM(stock) as stock_total,
        AVG(precio) as precio_promedio,
        MIN(precio) as precio_minimo,
        MAX(precio) as precio_maximo
      FROM productos
    `);

    const categorias = await query(`
      SELECT categoria, COUNT(*) as total
      FROM productos
      WHERE activo = true
      GROUP BY categoria
      ORDER BY total DESC
    `);

    // Convertir valores numéricos
    const statsData = stats[0];
    const formattedStats = {
      total: parseInt(statsData.total) || 0,
      activos: parseInt(statsData.activos) || 0,
      inactivos: parseInt(statsData.inactivos) || 0,
      destacados: parseInt(statsData.destacados) || 0,
      categorias: parseInt(statsData.categorias) || 0,
      stock_total: parseInt(statsData.stock_total) || 0,
      precio_promedio: parseFloat(statsData.precio_promedio) || 0,
      precio_minimo: parseFloat(statsData.precio_minimo) || 0,
      precio_maximo: parseFloat(statsData.precio_maximo) || 0
    };

    res.json({ 
      ok: true, 
      stats: formattedStats,
      categorias 
    });
  } catch (e) {
    console.error("Productos stats error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};
