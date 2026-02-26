const nodemailer = require('nodemailer');

let _transport = null;

function getTransport() {
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
  return _transport;
}

/**
 * Send welcome email to a new employee with their temporary password.
 */
async function sendWelcomeEmail({ name, email, tempPassword }) {
  const appName = process.env.APP_NAME || 'CRM System';
  const appUrl = process.env.APP_URL || 'http://localhost:5173';

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#0d1117; color:#e6edf3; margin:0; padding:0; }
  .wrap { max-width:520px; margin:40px auto; background:#161b22; border-radius:12px; overflow:hidden; border:1px solid #30363d; }
  .header { background:linear-gradient(135deg,#4f8ef7,#7c6af7); padding:32px; text-align:center; }
  .header h1 { margin:0; font-size:22px; color:#fff; }
  .header p { margin:6px 0 0; color:rgba(255,255,255,.8); font-size:13px; }
  .body { padding:32px; }
  .greeting { font-size:18px; font-weight:700; color:#e6edf3; margin-bottom:12px; }
  .text { color:#8b949e; line-height:1.7; font-size:14px; }
  .cred-box { background:#0d1117; border:1px solid #30363d; border-radius:8px; padding:20px; margin:20px 0; }
  .cred-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #21262d; }
  .cred-row:last-child { border:none; }
  .cred-label { color:#8b949e; font-size:13px; }
  .cred-value { color:#e6edf3; font-size:13px; font-weight:700; font-family:monospace; }
  .btn { display:block; text-align:center; background:linear-gradient(135deg,#4f8ef7,#7c6af7); color:#fff; text-decoration:none; padding:14px 24px; border-radius:8px; font-weight:700; font-size:14px; margin:24px 0; }
  .warning { background:#3d2b1f; border:1px solid #9a4f10; border-radius:8px; padding:14px; font-size:13px; color:#f0883e; margin-top:12px; }
  .footer { padding:20px 32px; border-top:1px solid #30363d; font-size:12px; color:#484f58; text-align:center; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🎉 Bienvenido a ${appName}</h1>
    <p>Tu cuenta ha sido creada por el administrador</p>
  </div>
  <div class="body">
    <div class="greeting">Hola, ${name} 👋</div>
    <p class="text">Tu cuenta en el sistema interno de Gestión RRHH & Ops ha sido creada. 
    Aquí están tus credenciales de acceso:</p>

    <div class="cred-box">
      <div class="cred-row">
        <span class="cred-label">Usuario (Email)</span>
        <span class="cred-value">${email}</span>
      </div>
      <div class="cred-row">
        <span class="cred-label">Contraseña temporal</span>
        <span class="cred-value">${tempPassword}</span>
      </div>
    </div>

    <a class="btn" href="${appUrl}/login">Ingresar al Sistema →</a>

    <div class="warning">
      ⚠️ <strong>Importante:</strong> Deberás cambiar esta contraseña en tu primer inicio de sesión. 
      La contraseña temporal no puede ser reutilizada.
    </div>
  </div>
  <div class="footer">${appName} · Sistema de Gestión Interna · Este correo es automático, no responder.</div>
</div>
</body></html>
  `.trim();

  await getTransport().sendMail({
    from: process.env.MAIL_FROM || `${appName} <${process.env.MAIL_USER}>`,
    to: `${name} <${email}>`,
    subject: `Bienvenido a ${appName} — Tus credenciales de acceso`,
    html,
  });
}

// ── module.exports moved to bottom so both functions are declared first ──

async function sendPasswordResetEmail({ name, email, code }) {
  const appName = process.env.APP_NAME || 'CRM System';
  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8">
<style>
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#0d1117; color:#e6edf3; margin:0; padding:0; }
  .wrap { max-width:480px; margin:40px auto; background:#161b22; border-radius:12px; border:1px solid #30363d; overflow:hidden; }
  .header { background:linear-gradient(135deg,#ef4444,#f97316); padding:28px; text-align:center; }
  .header h1 { margin:0; font-size:20px; color:#fff; }
  .body { padding:28px 32px; }
  .code-box { background:#0d1117; border:1px solid #30363d; border-radius:10px; padding:24px; text-align:center; margin:20px 0; }
  .code { font-size:38px; font-weight:800; letter-spacing:12px; color:#4f8ef7; font-family:monospace; }
  .exp  { font-size:12px; color:#8b949e; margin-top:8px; }
  .warn { background:#3d2b1f; border:1px solid #9a4f10; border-radius:8px; padding:12px; font-size:13px; color:#f0883e; margin-top:16px; }
  .footer { padding:16px 32px; border-top:1px solid #30363d; font-size:11px; color:#484f58; text-align:center; }
</style></head><body>
<div class="wrap">
  <div class="header"><h1>🔐 Recuperar Contraseña</h1></div>
  <div class="body">
    <p style="margin-bottom:4px;font-weight:700;font-size:16px">Hola, ${name}</p>
    <p style="color:#8b949e;font-size:14px;line-height:1.6">Recibimos una solicitud para restablecer tu contraseña. Usa el siguiente código de verificación:</p>
    <div class="code-box">
      <div class="code">${code}</div>
      <div class="exp">Válido por <strong>10 minutos</strong></div>
    </div>
    <div class="warn">⚠️ Si no solicitaste este código, ignora este mensaje. Tu cuenta sigue segura.</div>
  </div>
  <div class="footer">${appName} · Sistema de Gestión Interna · No responder a este correo.</div>
</div>
</body></html>`.trim();

  await getTransport().sendMail({
    from: process.env.MAIL_FROM || `${appName} <${process.env.MAIL_USER}>`,
    to: `${name} <${email}>`,
    subject: `${appName} — Código para restablecer contraseña`,
    html,
  });
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail };
