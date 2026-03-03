"use strict";
const { query } = require("../core/db");
const { v4: uuid } = require("uuid");
const nodemailer = require("nodemailer");

// Configurar transporter de email
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.MAIL_PORT) || 587,
  secure: process.env.MAIL_SECURE === 'true',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// ══════════════════════════════════════════════════════════════
// SUSCRIPTORES
// ══════════════════════════════════════════════════════════════

// Agregar suscriptor
exports.addSuscriptor = async (req, res) => {
  try {
    const { email, nombre, origen = 'modal_5min' } = req.body;
    const ip = req.ip || req.connection.remoteAddress || "";
    const session_id = req.body.session_id || null;

    if (!email) {
      return res.status(400).json({ error: "Email es requerido" });
    }

    // Verificar si ya existe
    const existing = await query(
      `SELECT id FROM suscriptores WHERE email = $1`,
      [email]
    );

    if (existing.length > 0) {
      return res.json({ 
        ok: true, 
        message: "Ya estás suscrito",
        already_subscribed: true 
      });
    }

    const id = uuid();
    await query(
      `INSERT INTO suscriptores (id, email, nombre, ip, session_id, origen)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, email, nombre || null, ip, session_id, origen]
    );

    res.json({ ok: true, message: "Suscripción exitosa", id });
  } catch (e) {
    console.error("Add suscriptor error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ══════════════════════════════════════════════════════════════
// CUPONES
// ══════════════════════════════════════════════════════════════

// Generar código único de cupón
const generarCodigoCupon = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = '';
  for (let i = 0; i < 8; i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return codigo;
};

// Crear cupón personalizado
exports.crearCuponPersonalizado = async (req, res) => {
  try {
    const {
      email,
      ip,
      producto_id,
      valor = 10, // 10% por defecto
      tipo = 'porcentaje',
      dias_expiracion = 7
    } = req.body;

    const codigo = generarCodigoCupon();
    const fecha_expiracion = new Date();
    fecha_expiracion.setDate(fecha_expiracion.getDate() + dias_expiracion);

    // Obtener info del producto si existe
    let metadata = {};
    if (producto_id) {
      const producto = await query(
        `SELECT nombre, precio FROM productos WHERE id = $1`,
        [producto_id]
      );
      if (producto.length > 0) {
        metadata = {
          producto_nombre: producto[0].nombre,
          producto_precio: producto[0].precio,
          razon: 'producto_mas_visto'
        };
      }
    }

    const id = uuid();
    await query(
      `INSERT INTO cupones 
       (id, codigo, tipo, valor, producto_id, email_destinatario, ip_destinatario, 
        fecha_expiracion, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        codigo,
        tipo,
        parseFloat(valor),
        producto_id || null,
        email || null,
        ip || null,
        fecha_expiracion,
        JSON.stringify(metadata)
      ]
    );

    res.json({ 
      ok: true, 
      cupon: { id, codigo, valor, tipo, fecha_expiracion, metadata } 
    });
  } catch (e) {
    console.error("Crear cupon error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// Validar cupón
exports.validarCupon = async (req, res) => {
  try {
    const { codigo, email, ip, producto_id } = req.body;

    if (!codigo) {
      return res.status(400).json({ error: "Código de cupón requerido" });
    }

    const cupones = await query(
      `SELECT * FROM cupones 
       WHERE codigo = $1 AND activo = true 
       AND (fecha_expiracion IS NULL OR fecha_expiracion > CURRENT_TIMESTAMP)
       AND usos_actuales < usos_maximos`,
      [codigo.toUpperCase()]
    );

    if (cupones.length === 0) {
      return res.status(404).json({ 
        error: "Cupón inválido, expirado o ya utilizado" 
      });
    }

    const cupon = cupones[0];

    // Verificar si es para un email específico (comentado para permitir uso desde cualquier cuenta)
    // if (cupon.email_destinatario && cupon.email_destinatario !== email) {
    //   return res.status(403).json({ 
    //     error: "Este cupón no es válido para tu cuenta" 
    //   });
    // }

    // Verificar si es para una IP específica (comentado para permitir uso desde cualquier dispositivo)
    // if (cupon.ip_destinatario && cupon.ip_destinatario !== ip) {
    //   return res.status(403).json({ 
    //     error: "Este cupón no es válido para tu sesión" 
    //   });
    // }

    // Verificar si es para un producto específico
    if (cupon.producto_id && cupon.producto_id !== producto_id) {
      return res.status(403).json({ 
        error: "Este cupón solo es válido para un producto específico" 
      });
    }

    res.json({ 
      ok: true, 
      cupon: {
        id: cupon.id,
        codigo: cupon.codigo,
        tipo: cupon.tipo,
        valor: parseFloat(cupon.valor),
        producto_id: cupon.producto_id,
        metadata: cupon.metadata
      }
    });
  } catch (e) {
    console.error("Validar cupon error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// Aplicar cupón (registrar uso)
exports.aplicarCupon = async (req, res) => {
  try {
    const { codigo, email, ip, descuento_aplicado, pedido_id } = req.body;

    // Validar cupón primero
    const cupones = await query(
      `SELECT * FROM cupones 
       WHERE codigo = $1 AND activo = true 
       AND usos_actuales < usos_maximos`,
      [codigo.toUpperCase()]
    );

    if (cupones.length === 0) {
      return res.status(404).json({ error: "Cupón no válido" });
    }

    const cupon = cupones[0];

    // Registrar uso
    await query(
      `INSERT INTO cupones_uso (id, cupon_id, pedido_id, email, ip, descuento_aplicado)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuid(), cupon.id, pedido_id || null, email, ip, descuento_aplicado]
    );

    // Incrementar contador de usos
    await query(
      `UPDATE cupones SET usos_actuales = usos_actuales + 1 WHERE id = $1`,
      [cupon.id]
    );

    res.json({ ok: true, message: "Cupón aplicado exitosamente" });
  } catch (e) {
    console.error("Aplicar cupon error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// ══════════════════════════════════════════════════════════════
// EMAIL MARKETING
// ══════════════════════════════════════════════════════════════

// Enviar email con cupón personalizado
exports.enviarEmailCupon = async (req, res) => {
  try {
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({ error: "IP requerida" });
    }

    console.log(`[Marketing] Buscando cupón para IP: ${ip}`);

    // Obtener el producto más visto por esta IP
    const productoMasVisto = await query(
      `SELECT 
        p.id, p.nombre, p.precio, p.imagen_url,
        COUNT(*) as vistas
       FROM eventos_productos e
       JOIN productos p ON p.id = e.producto_id
       WHERE e.ip = $1 
         AND e.created_at >= CURRENT_DATE - INTERVAL '7 days'
         AND e.tipo_evento IN ('producto_visto', 'producto_detalle')
       GROUP BY p.id, p.nombre, p.precio, p.imagen_url
       ORDER BY vistas DESC
       LIMIT 1`,
      [ip]
    );

    if (productoMasVisto.length === 0) {
      return res.status(404).json({ 
        error: "No se encontró actividad para esta IP" 
      });
    }

    const producto = productoMasVisto[0];
    console.log(`[Marketing] Producto más visto: ${producto.nombre} (${producto.vistas} vistas)`);

    // Crear cupón del 10%
    const codigo = generarCodigoCupon();
    const fecha_expiracion = new Date();
    fecha_expiracion.setDate(fecha_expiracion.getDate() + 7); // 7 días

    const cuponId = uuid();
    await query(
      `INSERT INTO cupones 
       (id, codigo, tipo, valor, producto_id, ip_destinatario, fecha_expiracion, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        cuponId,
        codigo,
        'porcentaje',
        10,
        producto.id,
        ip,
        fecha_expiracion,
        JSON.stringify({
          producto_nombre: producto.nombre,
          producto_precio: producto.precio,
          razon: 'producto_mas_visto',
          vistas: producto.vistas
        })
      ]
    );

    console.log(`[Marketing] Cupón creado: ${codigo}`);

    // Buscar suscriptor por IP (con variaciones de formato)
    // Primero intentar búsqueda exacta
    let suscriptor = await query(
      `SELECT email, nombre FROM suscriptores WHERE ip = $1 AND activo = true LIMIT 1`,
      [ip]
    );

    // Si no encuentra, intentar con LIKE para manejar variaciones de IPv6
    if (suscriptor.length === 0) {
      console.log(`[Marketing] No se encontró suscriptor con IP exacta: ${ip}`);
      console.log(`[Marketing] Intentando búsqueda flexible...`);
      
      // Limpiar IP de prefijos IPv6
      const cleanIp = ip.replace('::ffff:', '');
      
      suscriptor = await query(
        `SELECT email, nombre, ip as ip_registrada 
         FROM suscriptores 
         WHERE (ip = $1 OR ip LIKE $2 OR ip LIKE $3) 
           AND activo = true 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [cleanIp, `%${cleanIp}%`, `%${ip}%`]
      );
      
      if (suscriptor.length > 0) {
        console.log(`[Marketing] Suscriptor encontrado con búsqueda flexible: ${suscriptor[0].email} (IP registrada: ${suscriptor[0].ip_registrada})`);
      }
    } else {
      console.log(`[Marketing] Suscriptor encontrado: ${suscriptor[0].email}`);
    }

    if (suscriptor.length === 0) {
      console.log(`[Marketing] No hay email registrado para esta IP`);
      
      // Mostrar IPs disponibles en suscriptores para debug
      const allSuscriptores = await query(
        `SELECT ip, email FROM suscriptores WHERE activo = true ORDER BY created_at DESC LIMIT 5`
      );
      console.log(`[Marketing] IPs registradas en suscriptores:`, allSuscriptores.map(s => `${s.ip} (${s.email})`));
      
      // No hay email, retornar cupón para mostrar en modal
      return res.json({
        ok: true,
        sin_email: true,
        cupon: {
          codigo,
          producto: {
            nombre: producto.nombre,
            precio: producto.precio,
            imagen_url: producto.imagen_url
          },
          descuento: 10,
          expiracion: fecha_expiracion
        }
      });
    }

    const { email, nombre } = suscriptor[0];
    const precioConDescuento = (producto.precio * 0.9).toFixed(2);
    const linkProducto = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tienda?cupon=${codigo}&producto=${producto.id}`;

    console.log(`[Marketing] Preparando email para: ${email}`);

    // Enviar email
    const mailOptions = {
      from: process.env.MAIL_FROM || 'noreply@tuempresa.com',
      to: email,
      subject: `¡${nombre || 'Hola'}! Tenemos un 10% de descuento especial para ti`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">¡Oferta Especial Solo Para Ti!</h2>
          <p>Hola ${nombre || 'amigo'},</p>
          <p>Notamos que estuviste interesado en <strong>${producto.nombre}</strong>.</p>
          <p>¡Tenemos una oferta especial solo para ti!</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #4f46e5;">10% de Descuento</h3>
            <p style="font-size: 24px; font-weight: bold; margin: 10px 0;">
              <span style="text-decoration: line-through; color: #9ca3af;">$${producto.precio}</span>
              <span style="color: #10b981; margin-left: 10px;">$${precioConDescuento}</span>
            </p>
            <p style="margin: 10px 0;">Código de cupón: <strong style="font-size: 18px; color: #ef4444;">${codigo}</strong></p>
            <p style="font-size: 12px; color: #6b7280;">Válido por 7 días</p>
          </div>

          <a href="${linkProducto}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">
            Ver Producto con Descuento
          </a>

          <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
            Este cupón es personal y solo puede ser usado una vez. Expira el ${fecha_expiracion.toLocaleDateString('es-ES')}.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({
      ok: true,
      email_enviado: true,
      destinatario: email,
      cupon: { codigo, producto: producto.nombre }
    });
  } catch (e) {
    console.error("Enviar email cupon error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// Listar cupones (admin)
exports.listarCupones = async (req, res) => {
  try {
    const { activo, limit = 50 } = req.query;
    
    let where = ["1=1"];
    const params = [];

    if (activo !== undefined) {
      params.push(activo === 'true');
      where.push(`activo = $${params.length}`);
    }

    params.push(parseInt(limit) || 50);

    const cupones = await query(
      `SELECT c.*, p.nombre as producto_nombre
       FROM cupones c
       LEFT JOIN productos p ON p.id = c.producto_id
       WHERE ${where.join(" AND ")}
       ORDER BY c.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({ ok: true, cupones });
  } catch (e) {
    console.error("Listar cupones error:", e);
    res.status(500).json({ error: "Error del servidor" });
  }
};
