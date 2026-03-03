"use strict";
const { query } = require("../core/db");

// ══════════════════════════════════════════════════════════════
// TRACKING DE EVENTOS (Sin autenticación requerida)
// ══════════════════════════════════════════════════════════════

// ── Registrar evento ──────────────────────────────────────────
exports.track = async (req, res) => {
  try {
    const {
      producto_id,
      tipo_evento,
      session_id,
      metadata
    } = req.body;

    if (!tipo_evento || !session_id) {
      return res.status(400).json({
        error: "tipo_evento y session_id son requeridos"
      });
    }

    // Obtener información del request
    const ip = req.ip || req.connection.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";
    const referrer = req.headers.referer || req.headers.referrer || null;

    // Detectar tipo de dispositivo
    let deviceType = "desktop";
    if (userAgent) {
      if (/mobile/i.test(userAgent)) deviceType = "mobile";
      else if (/tablet/i.test(userAgent)) deviceType = "tablet";
    }

    await query(
      `INSERT INTO eventos_productos 
       (producto_id, tipo_evento, session_id, ip, user_agent, 
        device_type, referrer, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        producto_id || null,
        tipo_evento,
        session_id,
        ip,
        userAgent,
        deviceType,
        referrer,
        metadata ? JSON.stringify(metadata) : null
      ]
    );

    res.json({ ok: true, message: "Evento registrado" });
  } catch (e) {
    console.error("Evento track error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ══════════════════════════════════════════════════════════════
// ANALYTICS (Con autenticación - Solo Admin)
// ══════════════════════════════════════════════════════════════

// ── Estadísticas generales ────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    
    let dateFilter = "";
    const params = [];

    if (desde && hasta) {
      params.push(desde, hasta);
      dateFilter = `WHERE created_at >= $1 AND created_at <= $2`;
    } else if (desde) {
      params.push(desde);
      dateFilter = `WHERE created_at >= $1`;
    } else {
      // Por defecto últimos 30 días
      dateFilter = `WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'`;
    }

    const stats = await query(
      `SELECT 
        COUNT(*) as total_eventos,
        COUNT(DISTINCT session_id) as sesiones_unicas,
        COUNT(DISTINCT producto_id) as productos_vistos,
        COUNT(CASE WHEN tipo_evento = 'catalogo_visto' THEN 1 END) as vistas_catalogo,
        COUNT(CASE WHEN tipo_evento = 'producto_visto' THEN 1 END) as vistas_producto,
        COUNT(CASE WHEN tipo_evento = 'producto_detalle' THEN 1 END) as vistas_detalle,
        COUNT(CASE WHEN tipo_evento = 'contacto_click' THEN 1 END) as clicks_contacto,
        COUNT(CASE WHEN tipo_evento = 'filtro_usado' THEN 1 END) as filtros_usados,
        COUNT(CASE WHEN device_type = 'mobile' THEN 1 END) as mobile,
        COUNT(CASE WHEN device_type = 'desktop' THEN 1 END) as desktop,
        COUNT(CASE WHEN device_type = 'tablet' THEN 1 END) as tablet
       FROM eventos_productos
       ${dateFilter}`,
      params
    );

    // Calcular tasa de conversión (vistas → contacto)
    const s = stats[0];
    const vistasProducto = parseInt(s.vistas_producto) || 0;
    const clicksContacto = parseInt(s.clicks_contacto) || 0;
    const tasaConversion = vistasProducto > 0 
      ? ((clicksContacto / vistasProducto) * 100).toFixed(2)
      : 0;

    const formattedStats = {
      total_eventos: parseInt(s.total_eventos) || 0,
      sesiones_unicas: parseInt(s.sesiones_unicas) || 0,
      productos_vistos: parseInt(s.productos_vistos) || 0,
      vistas_catalogo: parseInt(s.vistas_catalogo) || 0,
      vistas_producto: vistasProducto,
      vistas_detalle: parseInt(s.vistas_detalle) || 0,
      clicks_contacto: clicksContacto,
      filtros_usados: parseInt(s.filtros_usados) || 0,
      mobile: parseInt(s.mobile) || 0,
      desktop: parseInt(s.desktop) || 0,
      tablet: parseInt(s.tablet) || 0,
      tasa_conversion: parseFloat(tasaConversion)
    };

    res.json({ 
      ok: true, 
      stats: formattedStats
    });
  } catch (e) {
    console.error("Eventos stats error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Productos más vistos ──────────────────────────────────────
exports.getTopProductos = async (req, res) => {
  try {
    const { limit = 10, desde, hasta } = req.query;
    
    let dateFilter = "";
    const params = [];

    if (desde && hasta) {
      params.push(desde, hasta);
      dateFilter = `AND e.created_at >= $${params.length - 1} AND e.created_at <= $${params.length}`;
    } else {
      dateFilter = `AND e.created_at >= CURRENT_DATE - INTERVAL '30 days'`;
    }

    params.push(parseInt(limit) || 10);

    const rows = await query(
      `SELECT 
        p.id, p.nombre, p.precio, p.imagen_url, p.categoria,
        COUNT(CASE WHEN e.tipo_evento = 'producto_visto' THEN 1 END) as vistas,
        COUNT(CASE WHEN e.tipo_evento = 'producto_detalle' THEN 1 END) as detalles,
        COUNT(CASE WHEN e.tipo_evento = 'contacto_click' THEN 1 END) as contactos,
        COUNT(DISTINCT e.session_id) as sesiones_unicas
       FROM productos p
       INNER JOIN eventos_productos e ON e.producto_id = p.id
       WHERE 1=1 ${dateFilter}
       GROUP BY p.id, p.nombre, p.precio, p.imagen_url, p.categoria
       ORDER BY vistas DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({ ok: true, productos: rows });
  } catch (e) {
    console.error("Top productos error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Eventos por día (últimos 30 días) ─────────────────────────
exports.getEvolutivo = async (req, res) => {
  try {
    const rows = await query(`
      SELECT 
        DATE(created_at) as fecha,
        COUNT(*) as total_eventos,
        COUNT(DISTINCT session_id) as sesiones,
        COUNT(CASE WHEN tipo_evento = 'producto_visto' THEN 1 END) as vistas,
        COUNT(CASE WHEN tipo_evento = 'contacto_click' THEN 1 END) as contactos
      FROM eventos_productos
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY fecha ASC
    `);

    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error("Evolutivo error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Eventos recientes (tiempo real) ───────────────────────────
exports.getRecientes = async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const rows = await query(
      `SELECT 
        e.id, e.tipo_evento, e.session_id, e.device_type, 
        e.created_at, p.nombre as producto_nombre, p.precio
       FROM eventos_productos e
       LEFT JOIN productos p ON p.id = e.producto_id
       ORDER BY e.created_at DESC
       LIMIT $1`,
      [parseInt(limit) || 50]
    );

    res.json({ ok: true, eventos: rows });
  } catch (e) {
    console.error("Eventos recientes error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Eventos por tipo ──────────────────────────────────────────
exports.getPorTipo = async (req, res) => {
  try {
    const rows = await query(`
      SELECT 
        tipo_evento,
        COUNT(*) as total,
        COUNT(DISTINCT session_id) as sesiones_unicas,
        COUNT(DISTINCT DATE(created_at)) as dias_activos
      FROM eventos_productos
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY tipo_evento
      ORDER BY total DESC
    `);

    res.json({ ok: true, eventos: rows });
  } catch (e) {
    console.error("Eventos por tipo error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};
