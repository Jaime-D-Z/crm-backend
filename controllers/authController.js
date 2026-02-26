const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const LoginIntento = require('../models/LoginIntento');
const Permission = require('../models/Permission');
const { getDashboard } = require('../middlewares/auth');
const { body, validationResult } = require('express-validator');

// ── Login ─────────────────────────────────────────────────
async function login(req, res) {
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || '0.0.0.0';

  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña son requeridos.' });

  // Check if IP/email is blocked
  const blockInfo = await LoginIntento.isBlocked(ip, email).catch(() => null);
  if (blockInfo?.blocked) {
    return res.status(429).json({
      error: `Cuenta bloqueada por múltiples intentos fallidos. Intenta de nuevo en ${blockInfo.remaining} minuto(s).`,
      code: 'ACCOUNT_BLOCKED',
      remaining: blockInfo.remaining,
    });
  }

  try {
    const user = await User.findByEmail(email);

    if (!user || !(await User.verifyPassword(user, password))) {
      // Record failed attempt
      const intentos = await LoginIntento.record(ip, email);
      const restantes = Math.max(0, 5 - intentos);

      if (user) {
        await AuditLog.log(user.id, 'login_failed', req, { reason: 'wrong_password', intentos });
      }

      if (intentos >= 5) {
        return res.status(429).json({
          error: 'Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos.',
          code: 'ACCOUNT_BLOCKED',
          remaining: 15,
        });
      }

      return res.status(401).json({
        error: `Credenciales incorrectas. ${restantes > 0 ? `Te quedan ${restantes} intento(s).` : ''}`.trim(),
      });
    }

    if (!user.is_active) {
      await AuditLog.log(user.id, 'login_blocked', req, { reason: 'account_inactive' });
      return res.status(403).json({ error: 'Cuenta inactiva. Contacta al administrador.' });
    }

    // Clear previous failed attempts
    await LoginIntento.clear(ip, email);

    // Get permissions for this user's role
    const permisos = user.role_id ? [...(await Permission.getByRole(user.role_id))] : [];

    // Regenerate session
    req.session.regenerate(async (err) => {
      if (err) return res.status(500).json({ error: 'Error de sesión.' });

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'crm_secret_key_2024_!!!';

      const token = jwt.sign({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roleId: user.role_id,
        permisos: permisos,
        primerAcceso: !!user.primer_acceso
      }, JWT_SECRET, { expiresIn: '8h' });

      req.session.userId = user.id;
      req.session.userName = user.name;
      req.session.userEmail = user.email;
      req.session.userRole = user.role;
      req.session.roleName = user.role_name || user.role;
      req.session.roleId = user.role_id;
      req.session.permisos = permisos;
      req.session.primerAcceso = !!user.primer_acceso;

      await User.updateLastLogin(user.id);
      await AuditLog.log(user.id, 'login', req, { ip, role: user.role, roleName: user.role_name });

      // Primer acceso → force password change
      if (user.primer_acceso) {
        return res.json({ ok: true, token, redirectTo: '/change-password', primerAcceso: true, name: user.name });
      }

      const redirectTo = getDashboard(user.role_name || user.role);
      res.json({ ok: true, token, redirectTo, role: user.role, roleName: user.role_name, name: user.name });
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error del servidor.' });
  }
}

// ── Change Password (primer acceso) ──────────────────────
const changePasswordValidators = [
  body('passwordActual').notEmpty().withMessage('Contraseña actual requerida.'),
  body('passwordNueva')
    .isLength({ min: 8 }).withMessage('Mínimo 8 caracteres.')
    .matches(/[A-Z]/).withMessage('Debe incluir al menos una mayúscula.')
    .matches(/[0-9]/).withMessage('Debe incluir al menos un número.')
    .matches(/[^A-Za-z0-9]/).withMessage('Debe incluir al menos un símbolo.'),
  body('passwordConfirm').custom((val, { req }) => {
    if (val !== req.body.passwordNueva) throw new Error('Las contraseñas no coinciden.');
    return true;
  }),
];

async function changePassword(req, res) {
  // Validate
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map(e => e.msg) });
  }

  const { passwordActual, passwordNueva } = req.body;
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    // Verify current password
    const valid = await User.verifyPassword(user, passwordActual);
    if (!valid) return res.status(401).json({ errors: ['La contraseña actual es incorrecta.'] });

    // No puede ser igual a la temporal almacenada
    if (user.temp_password) {
      const sameAsTemp = await require('bcrypt').compare(passwordNueva, user.password);
      // Actually check if new = current password (which IS the temp)
      if (sameAsTemp) {
        return res.status(400).json({ errors: ['La nueva contraseña no puede ser igual a la contraseña temporal.'] });
      }
    }

    await User.changePassword(userId, passwordNueva);
    await User.clearFirstAccess(userId);
    req.session.primerAcceso = false;

    await AuditLog.log(userId, 'password_changed', req, { primer_acceso: true });

    const roleName = user.role_name || user.role;

    // Generate fresh token with primerAcceso = false
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'crm_secret_key_2024_!!!';
    const Permission = require('../models/Permission');
    const permisos = user.role_id ? [...(await Permission.getByRole(user.role_id))] : [];

    const token = jwt.sign({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleId: user.role_id,
      permisos: permisos,
      primerAcceso: false
    }, JWT_SECRET, { expiresIn: '8h' });

    res.json({
      ok: true,
      token,
      redirectTo: getDashboard(roleName),
      message: '¡Contraseña actualizada exitosamente!'
    });

  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ error: 'Error del servidor.' });
  }
}

// ── Logout ────────────────────────────────────────────────
async function logout(req, res) {
  const userId = req.session?.userId;
  if (userId) await AuditLog.log(userId, 'logout', req).catch(() => { });
  req.session.destroy(() => {
    res.clearCookie('crm.sid');
    res.json({ ok: true });
  });
}

// ── Me (current user + permissions) ──────────────────────
async function me(req, res) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });

  // Refresh permissions if not in session
  let permisos = req.session.permisos || [];
  if (!permisos.length && req.session.roleId) {
    permisos = [...(await Permission.getByRole(req.session.roleId))];
    req.session.permisos = permisos;
  }

  res.json({
    userId: req.session.userId,
    userName: req.session.userName,
    userEmail: req.session.userEmail,
    userRole: req.session.userRole,
    roleName: req.session.roleName,
    roleId: req.session.roleId,
    primerAcceso: req.session.primerAcceso || false,
    permisos,
  });
}

// ── Forgot Password — Step 1: request OTP ─────────────────
async function requestPasswordReset(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido.' });

  try {
    const user = await User.findByEmail(email);
    // Always respond generically to prevent user enumeration
    if (!user) {
      return res.json({ ok: true, message: 'Si el correo existe, recibirás un código en tu bandeja.' });
    }

    const Otp = require('../models/Otp');
    const { sendPasswordResetEmail } = require('../core/mailer');

    const code = Otp.generate(user.id, user.email, 'password_reset');
    await sendPasswordResetEmail({ name: user.name, email: user.email, code });

    res.json({ ok: true, message: 'Código enviado. Revisa tu correo.' });
  } catch (err) {
    console.error('requestPasswordReset error:', err);
    res.status(500).json({ error: 'Error al enviar el código. Intenta de nuevo.' });
  }
}

// ── Forgot Password — Step 2: verify OTP + set new password ─
async function confirmPasswordReset(req, res) {
  const { email, code, passwordNueva, passwordConfirm } = req.body;

  if (!email || !code || !passwordNueva || !passwordConfirm)
    return res.status(400).json({ error: 'Todos los campos son requeridos.' });

  if (passwordNueva !== passwordConfirm)
    return res.status(400).json({ error: 'Las contraseñas no coinciden.' });

  if (passwordNueva.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });

  if (!/[A-Z]/.test(passwordNueva))
    return res.status(400).json({ error: 'Debe incluir al menos una letra mayúscula.' });

  if (!/[0-9]/.test(passwordNueva))
    return res.status(400).json({ error: 'Debe incluir al menos un número.' });

  if (!/[^A-Za-z0-9]/.test(passwordNueva))
    return res.status(400).json({ error: 'Debe incluir al menos un símbolo (ej: @, #, !).' });

  try {
    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const Otp = require('../models/Otp');
    const valid = Otp.verify(user.id, code, 'password_reset');
    if (!valid) return res.status(400).json({ error: 'Código incorrecto o expirado.' });

    await User.changePassword(user.id, passwordNueva);
    await User.clearFirstAccess(user.id);

    await AuditLog.log(user.id, 'password_reset', req, { via: 'forgot_password' });

    res.json({ ok: true, message: '¡Contraseña restablecida exitosamente! Ahora puedes iniciar sesión.' });
  } catch (err) {
    console.error('confirmPasswordReset error:', err);
    res.status(500).json({ error: 'Error del servidor.' });
  }
}

async function listUsers(req, res) {
  try {
    const { query } = require('../core/db');
    const rows = await query(`
      SELECT u.id, u.name, u.email, u.role, r.nombre AS role_name 
      FROM users u 
      LEFT JOIN roles r ON r.id = u.role_id 
      WHERE u.is_active = TRUE
      ORDER BY u.name ASC
    `);
    res.json({ ok: true, users: rows });
  } catch (err) {
    console.error('listUsers error:', err);
    res.status(500).json({ error: 'Error del servidor.' });
  }
}

module.exports = { login, logout, me, listUsers, changePassword, changePasswordValidators, requestPasswordReset, confirmPasswordReset };
