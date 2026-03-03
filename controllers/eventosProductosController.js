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
        COUNT(DISTINCT ip) as ips_unicas,
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
      ips_unicas: parseInt(s.ips_unicas) || 0,
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
        e.ip, e.user_agent, e.created_at, 
        p.nombre as producto_nombre, p.precio
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

// ── Usuarios únicos con IPs ───────────────────────────────────
exports.getUsuariosUnicos = async (req, res) => {
  try {
    const rows = await query(`
      SELECT 
        e.session_id,
        e.ip,
        e.device_type,
        s.email,
        s.nombre as suscriptor_nombre,
        MIN(e.created_at) as primera_visita,
        MAX(e.created_at) as ultima_actividad,
        COUNT(*) as total_eventos,
        COUNT(DISTINCT e.producto_id) as productos_vistos,
        COUNT(CASE WHEN e.tipo_evento = 'contacto_click' THEN 1 END) as contactos,
        -- Calcular tiempo en página (diferencia entre primera y última actividad)
        EXTRACT(EPOCH FROM (MAX(e.created_at) - MIN(e.created_at)))::INTEGER as tiempo_en_pagina_segundos,
        -- Formatear tiempo en minutos y segundos
        CASE 
          WHEN EXTRACT(EPOCH FROM (MAX(e.created_at) - MIN(e.created_at))) < 60 THEN
            EXTRACT(EPOCH FROM (MAX(e.created_at) - MIN(e.created_at)))::INTEGER || 's'
          ELSE
            (EXTRACT(EPOCH FROM (MAX(e.created_at) - MIN(e.created_at))) / 60)::INTEGER || 'm ' ||
            (EXTRACT(EPOCH FROM (MAX(e.created_at) - MIN(e.created_at)))::INTEGER % 60) || 's'
        END as tiempo_formateado
      FROM eventos_productos e
      LEFT JOIN suscriptores s ON (e.ip = s.ip OR e.ip LIKE '%' || s.ip || '%' OR s.ip LIKE '%' || e.ip || '%') AND s.activo = true
      WHERE e.created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY e.session_id, e.ip, e.device_type, s.email, s.nombre
      ORDER BY ultima_actividad DESC
      LIMIT 50
    `);

    res.json({ ok: true, usuarios: rows });
  } catch (e) {
    console.error("Usuarios unicos error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};


// ── Clientes Potenciales (Lead Scoring) ───────────────────────
exports.getClientesPotenciales = async (req, res) => {
  try {
    const rows = await query(`
      SELECT 
        e.session_id,
        e.ip,
        e.device_type,
        s.email,
        s.nombre as suscriptor_nombre,
        MIN(e.created_at) as primera_visita,
        MAX(e.created_at) as ultima_actividad,
        COUNT(*) as total_eventos,
        COUNT(DISTINCT e.producto_id) as productos_vistos,
        COUNT(CASE WHEN e.tipo_evento = 'producto_visto' THEN 1 END) as vistas_producto,
        COUNT(CASE WHEN e.tipo_evento = 'producto_detalle' THEN 1 END) as vistas_detalle,
        COUNT(CASE WHEN e.tipo_evento = 'contacto_click' THEN 1 END) as contactos,
        COUNT(CASE WHEN e.tipo_evento = 'producto_agregado_carrito' THEN 1 END) as agregados_carrito,
        -- Lead Score: Puntuación de 0-100
        (
          (COUNT(DISTINCT e.producto_id) * 10) +  -- 10 puntos por producto visto
          (COUNT(CASE WHEN e.tipo_evento = 'producto_detalle' THEN 1 END) * 15) +  -- 15 puntos por ver detalles
          (COUNT(CASE WHEN e.tipo_evento = 'producto_agregado_carrito' THEN 1 END) * 25) +  -- 25 puntos por agregar al carrito
          (CASE WHEN COUNT(*) >= 10 THEN 20 ELSE COUNT(*) * 2 END)  -- Bonus por actividad
        ) as lead_score
      FROM eventos_productos e
      LEFT JOIN suscriptores s ON (e.ip = s.ip OR e.ip LIKE '%' || s.ip || '%' OR s.ip LIKE '%' || e.ip || '%') AND s.activo = true
      WHERE e.created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY e.session_id, e.ip, e.device_type, s.email, s.nombre
      HAVING 
        COUNT(CASE WHEN e.tipo_evento = 'contacto_click' THEN 1 END) = 0  -- Sin contacto
        AND (
          COUNT(DISTINCT e.producto_id) >= 2  -- Vio 2+ productos
          OR COUNT(*) >= 5  -- O tiene 5+ eventos
          OR COUNT(CASE WHEN e.tipo_evento = 'producto_detalle' THEN 1 END) >= 1  -- O vio detalles
        )
      ORDER BY lead_score DESC, ultima_actividad DESC
      LIMIT 100
    `);

    // Clasificar por nivel de interés
    const clasificados = rows.map(u => {
      const score = parseInt(u.lead_score) || 0;
      let nivel_interes = 'Bajo';
      let prioridad = 3;
      
      if (score >= 80 || u.productos_vistos >= 5) {
        nivel_interes = 'Alto';
        prioridad = 1;
      } else if (score >= 40 || u.productos_vistos >= 3) {
        nivel_interes = 'Medio';
        prioridad = 2;
      }

      return {
        ...u,
        lead_score: score,
        nivel_interes,
        prioridad,
        dias_inactivo: Math.floor((Date.now() - new Date(u.ultima_actividad)) / (1000 * 60 * 60 * 24))
      };
    });

    res.json({ 
      ok: true, 
      clientes_potenciales: clasificados,
      total: clasificados.length,
      por_nivel: {
        alto: clasificados.filter(c => c.nivel_interes === 'Alto').length,
        medio: clasificados.filter(c => c.nivel_interes === 'Medio').length,
        bajo: clasificados.filter(c => c.nivel_interes === 'Bajo').length
      }
    });
  } catch (e) {
    console.error("Clientes potenciales error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Funnel de Checkout ────────────────────────────────────────
exports.getCheckoutFunnel = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    
    let dateFilter = "";
    const params = [];

    if (desde && hasta) {
      params.push(desde, hasta);
      dateFilter = `WHERE created_at >= $1 AND created_at <= $2`;
    } else {
      dateFilter = `WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'`;
    }

    const funnel = await query(
      `SELECT 
        COUNT(CASE WHEN tipo_evento = 'producto_agregado_carrito' THEN 1 END) as agregados_carrito,
        COUNT(CASE WHEN tipo_evento = 'checkout_iniciado' THEN 1 END) as checkout_iniciado,
        COUNT(CASE WHEN tipo_evento = 'checkout_paso_1_completado' THEN 1 END) as paso_1_completado,
        COUNT(CASE WHEN tipo_evento = 'checkout_abandonado' THEN 1 END) as checkout_abandonado,
        COUNT(CASE WHEN tipo_evento = 'compra_completada' THEN 1 END) as compras_completadas
       FROM eventos_productos
       ${dateFilter}`,
      params
    );

    const stats = funnel[0];
    
    // Calcular tasas de conversión
    const agregados = parseInt(stats.agregados_carrito) || 0;
    const iniciados = parseInt(stats.checkout_iniciado) || 0;
    const completados = parseInt(stats.compras_completadas) || 0;
    const abandonados = parseInt(stats.checkout_abandonado) || 0;

    const tasaInicio = agregados > 0 ? ((iniciados / agregados) * 100).toFixed(2) : 0;
    const tasaCompletado = iniciados > 0 ? ((completados / iniciados) * 100).toFixed(2) : 0;
    const tasaAbandono = iniciados > 0 ? ((abandonados / iniciados) * 100).toFixed(2) : 0;

    res.json({
      ok: true,
      funnel: {
        agregados_carrito: agregados,
        checkout_iniciado: iniciados,
        paso_1_completado: parseInt(stats.paso_1_completado) || 0,
        checkout_abandonado: abandonados,
        compras_completadas: completados,
        tasa_inicio: parseFloat(tasaInicio),
        tasa_completado: parseFloat(tasaCompletado),
        tasa_abandono: parseFloat(tasaAbandono)
      }
    });
  } catch (e) {
    console.error("Checkout funnel error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};
