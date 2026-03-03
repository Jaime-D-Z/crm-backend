"use strict";
const { query } = require("../core/db");
const { v4: uuid } = require("uuid");

// ══════════════════════════════════════════════════════════════
// ENDPOINTS PÚBLICOS - CHECKOUT Y PEDIDOS
// ══════════════════════════════════════════════════════════════

// ── Crear pedido (checkout) ───────────────────────────────────
exports.create = async (req, res) => {
  try {
    const {
      cliente_nombre,
      cliente_email,
      cliente_telefono,
      direccion_calle,
      direccion_ciudad,
      direccion_estado,
      direccion_codigo_postal,
      direccion_pais,
      metodo_pago,
      tarjeta_numero,
      tarjeta_nombre,
      tarjeta_expiracion,
      tarjeta_cvv,
      items,
      notas_cliente
    } = req.body;

    // Validaciones básicas
    if (!cliente_nombre || !cliente_email || !items || items.length === 0) {
      return res.status(400).json({
        error: "Datos incompletos: nombre, email y productos son requeridos"
      });
    }

    if (!metodo_pago) {
      return res.status(400).json({
        error: "Método de pago es requerido"
      });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cliente_email)) {
      return res.status(400).json({
        error: "Email inválido"
      });
    }

    // Validar tarjeta si es pago con tarjeta
    if (metodo_pago === "tarjeta_credito" || metodo_pago === "tarjeta_debito") {
      if (!tarjeta_numero || !tarjeta_nombre || !tarjeta_expiracion || !tarjeta_cvv) {
        return res.status(400).json({
          error: "Datos de tarjeta incompletos"
        });
      }

      // Validar formato de tarjeta (simulado)
      const numeroLimpio = tarjeta_numero.replace(/\s/g, "");
      if (numeroLimpio.length < 13 || numeroLimpio.length > 19) {
        return res.status(400).json({
          error: "Número de tarjeta inválido"
        });
      }

      // Validar CVV
      if (tarjeta_cvv.length < 3 || tarjeta_cvv.length > 4) {
        return res.status(400).json({
          error: "CVV inválido"
        });
      }
    }

    // Obtener información de tracking
    const session_id = req.body.session_id || uuid();
    const ip = req.ip || req.connection.remoteAddress || "";
    const user_agent = req.headers["user-agent"] || "";

    // Calcular totales
    let subtotal = 0;
    const detalles = [];

    for (const item of items) {
      // Verificar que el producto existe y está activo
      const producto = await query(
        `SELECT id, nombre, descripcion, precio, imagen_url, stock, activo
         FROM productos WHERE id = $1`,
        [item.producto_id]
      );

      if (producto.length === 0) {
        return res.status(404).json({
          error: `Producto ${item.producto_id} no encontrado`
        });
      }

      const prod = producto[0];

      if (!prod.activo) {
        return res.status(400).json({
          error: `Producto ${prod.nombre} no está disponible`
        });
      }

      const cantidad = parseInt(item.cantidad) || 1;
      if (cantidad < 1) {
        return res.status(400).json({
          error: "Cantidad debe ser mayor a 0"
        });
      }

      // Verificar stock (opcional)
      if (prod.stock !== null && prod.stock < cantidad) {
        return res.status(400).json({
          error: `Stock insuficiente para ${prod.nombre}`
        });
      }

      const precio = parseFloat(prod.precio);
      const itemSubtotal = precio * cantidad;
      subtotal += itemSubtotal;

      detalles.push({
        producto_id: prod.id,
        producto_nombre: prod.nombre,
        producto_descripcion: prod.descripcion,
        producto_imagen_url: prod.imagen_url,
        precio_unitario: precio,
        cantidad: cantidad,
        subtotal: itemSubtotal
      });
    }

    // Calcular impuestos y envío (simulado)
    const impuestos = subtotal * 0.16; // IVA 16%
    const envio = subtotal > 500 ? 0 : 99; // Envío gratis > $500
    const total = subtotal + impuestos + envio;

    // Generar número de orden
    const numeroOrden = await query(`SELECT generar_numero_orden() as numero`);
    const numero_orden = numeroOrden[0].numero;

    // Simular procesamiento de pago
    let estado_pago = "pendiente";
    let transaccion_id = null;
    let tarjeta_ultimos4 = null;
    let tarjeta_marca = null;

    if (metodo_pago === "tarjeta_credito" || metodo_pago === "tarjeta_debito") {
      // SIMULACIÓN DE PAGO
      // En producción real, aquí se integraría con Stripe, PayPal, etc.
      
      const numeroLimpio = tarjeta_numero.replace(/\s/g, "");
      tarjeta_ultimos4 = numeroLimpio.slice(-4);
      
      // Detectar marca de tarjeta (simulado)
      if (numeroLimpio.startsWith("4")) {
        tarjeta_marca = "Visa";
      } else if (numeroLimpio.startsWith("5")) {
        tarjeta_marca = "Mastercard";
      } else if (numeroLimpio.startsWith("3")) {
        tarjeta_marca = "American Express";
      } else {
        tarjeta_marca = "Desconocida";
      }

      // Simular aprobación (90% de éxito)
      const aprobado = Math.random() > 0.1;
      
      if (aprobado) {
        estado_pago = "aprobado";
        transaccion_id = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      } else {
        estado_pago = "rechazado";
        return res.status(400).json({
          error: "Pago rechazado. Por favor, verifica los datos de tu tarjeta."
        });
      }
    } else if (metodo_pago === "paypal") {
      // Simular PayPal
      estado_pago = "aprobado";
      transaccion_id = `PP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    } else if (metodo_pago === "transferencia") {
      estado_pago = "pendiente";
      transaccion_id = `TRANS-${Date.now()}`;
    }

    // Crear pedido
    const pedido_id = uuid();
    await query(
      `INSERT INTO pedidos 
       (id, numero_orden, cliente_nombre, cliente_email, cliente_telefono,
        direccion_calle, direccion_ciudad, direccion_estado, 
        direccion_codigo_postal, direccion_pais,
        subtotal, impuestos, envio, total,
        estado, metodo_pago, estado_pago,
        tarjeta_ultimos4, tarjeta_marca, transaccion_id,
        session_id, ip, user_agent, notas_cliente, fecha_pago)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
      [
        pedido_id,
        numero_orden,
        cliente_nombre,
        cliente_email,
        cliente_telefono || null,
        direccion_calle || null,
        direccion_ciudad || null,
        direccion_estado || null,
        direccion_codigo_postal || null,
        direccion_pais || "México",
        subtotal,
        impuestos,
        envio,
        total,
        estado_pago === "aprobado" ? "pagado" : "pendiente",
        metodo_pago,
        estado_pago,
        tarjeta_ultimos4,
        tarjeta_marca,
        transaccion_id,
        session_id,
        ip,
        user_agent,
        notas_cliente || null,
        estado_pago === "aprobado" ? new Date() : null
      ]
    );

    // Crear detalles del pedido
    for (const detalle of detalles) {
      await query(
        `INSERT INTO pedidos_detalle 
         (id, pedido_id, producto_id, producto_nombre, producto_descripcion,
          producto_imagen_url, precio_unitario, cantidad, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          uuid(),
          pedido_id,
          detalle.producto_id,
          detalle.producto_nombre,
          detalle.producto_descripcion,
          detalle.producto_imagen_url,
          detalle.precio_unitario,
          detalle.cantidad,
          detalle.subtotal
        ]
      );

      // Actualizar stock (opcional)
      await query(
        `UPDATE productos 
         SET stock = GREATEST(0, stock - $1)
         WHERE id = $2 AND stock IS NOT NULL`,
        [detalle.cantidad, detalle.producto_id]
      );
    }

    res.json({
      ok: true,
      pedido: {
        id: pedido_id,
        numero_orden,
        total,
        estado: estado_pago === "aprobado" ? "pagado" : "pendiente",
        estado_pago,
        transaccion_id
      },
      message: estado_pago === "aprobado" 
        ? "¡Pago procesado exitosamente!" 
        : "Pedido creado. Pendiente de pago."
    });

  } catch (e) {
    console.error("Pedido create error:", e);
    res.status(500).json({ error: "Error al procesar el pedido" });
  }
};

// ── Consultar pedido por número de orden ─────────────────────
exports.getByNumero = async (req, res) => {
  try {
    const { numero } = req.params;

    const pedido = await query(
      `SELECT * FROM pedidos WHERE numero_orden = $1`,
      [numero]
    );

    if (pedido.length === 0) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const detalles = await query(
      `SELECT * FROM pedidos_detalle WHERE pedido_id = $1`,
      [pedido[0].id]
    );

    res.json({
      ok: true,
      pedido: {
        ...pedido[0],
        items: detalles
      }
    });
  } catch (e) {
    console.error("Pedido get error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ══════════════════════════════════════════════════════════════
// ENDPOINTS ADMIN
// ══════════════════════════════════════════════════════════════

// ── Listar pedidos (admin) ────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const { estado, estado_pago, desde, hasta, limit = 50, offset = 0 } = req.query;

    let where = ["1=1"];
    const params = [];

    if (estado) {
      params.push(estado);
      where.push(`estado = $${params.length}`);
    }

    if (estado_pago) {
      params.push(estado_pago);
      where.push(`estado_pago = $${params.length}`);
    }

    if (desde) {
      params.push(desde);
      where.push(`fecha_pedido >= $${params.length}`);
    }

    if (hasta) {
      params.push(hasta);
      where.push(`fecha_pedido <= $${params.length}`);
    }

    params.push(parseInt(limit) || 50, parseInt(offset) || 0);

    const pedidos = await query(
      `SELECT * FROM pedidos
       WHERE ${where.join(" AND ")}
       ORDER BY fecha_pedido DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const total = await query(
      `SELECT COUNT(*) as c FROM pedidos WHERE ${where.join(" AND ")}`,
      params.slice(0, -2)
    );

    res.json({
      ok: true,
      pedidos,
      total: parseInt(total[0].c)
    });
  } catch (e) {
    console.error("Pedidos list error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Estadísticas de pedidos ───────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_pedidos,
        COUNT(CASE WHEN estado_pago = 'aprobado' THEN 1 END) as pagados,
        COUNT(CASE WHEN estado_pago = 'pendiente' THEN 1 END) as pendientes,
        COUNT(CASE WHEN estado_pago = 'rechazado' THEN 1 END) as rechazados,
        SUM(CASE WHEN estado_pago = 'aprobado' THEN total ELSE 0 END) as ingresos_total,
        AVG(CASE WHEN estado_pago = 'aprobado' THEN total END) as ticket_promedio,
        COUNT(DISTINCT cliente_email) as clientes_unicos
      FROM pedidos
      WHERE fecha_pedido >= CURRENT_DATE - INTERVAL '30 days'
    `);

    res.json({ ok: true, stats: stats[0] });
  } catch (e) {
    console.error("Pedidos stats error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ── Actualizar estado de pedido ───────────────────────────────
exports.updateEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, notas_internas } = req.body;

    const updates = ["estado = $1"];
    const params = [estado, id];

    if (notas_internas !== undefined) {
      updates.push("notas_internas = $2");
      params.splice(1, 0, notas_internas);
      params[params.length - 1] = id;
    }

    // Actualizar fechas según estado
    if (estado === "enviado") {
      updates.push(`fecha_envio = CURRENT_TIMESTAMP`);
    } else if (estado === "entregado") {
      updates.push(`fecha_entrega = CURRENT_TIMESTAMP`);
    }

    await query(
      `UPDATE pedidos SET ${updates.join(", ")} WHERE id = $${params.length}`,
      params
    );

    res.json({ ok: true, message: "Estado actualizado" });
  } catch (e) {
    console.error("Pedido update error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

module.exports = exports;
