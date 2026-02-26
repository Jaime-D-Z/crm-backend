/**
 * Auth middlewares — Session-based (compatible with express-session + MySQL store)
 * RBAC roles: super_admin | admin_rrhh | instructor | developer | assistant
 */

const ROLE_DASHBOARD = {
  super_admin: '/admin/dashboard',
  admin_rrhh: '/admin/dashboard',
  instructor: '/employee/dashboard',
  developer: '/employee/dashboard',
  assistant: '/employee/dashboard',
  admin: '/admin/dashboard',   // legacy
  employee: '/employee/dashboard', // legacy
};

function getDashboard(role) {
  return ROLE_DASHBOARD[role] || '/employee/dashboard';
}

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'crm_secret_key_2024_!!!';

/** Any authenticated user (supports Session or JWT) */
function requireAuth(req, res, next) {
  // 1. Try JWT first (Authorization: Bearer <token>)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded; // Populate req.user for JWT
      // Map to session-like object for compatibility if needed
      req.session = req.session || {};
      req.session.userId = decoded.id;
      req.session.userRole = decoded.role;
      req.session.roleName = decoded.role;
      req.session.roleId = decoded.roleId;
      req.session.permisos = decoded.permisos || [];
      req.session.primerAcceso = !!decoded.primerAcceso;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o expirado.', code: 'INVALID_TOKEN' });
    }
  }

  // 2. Fallback to Session
  if (!req.session?.userId) {
    if (_isApi(req)) return res.status(401).json({ error: 'No autenticado.' });
    return res.redirect('/login');
  }
  // Block primer_acceso users from all routes except /change-password, /api/auth/me, and /api/auth/change-password
  if (req.session.primerAcceso &&
    !req.path.startsWith('/change-password') &&
    !req.path.startsWith('/api/auth/me') &&
    !req.path.startsWith('/api/auth/change-password')) {
    if (_isApi(req)) return res.status(403).json({ error: 'Debes cambiar tu contraseña antes de continuar.', code: 'PRIMER_ACCESO' });
    return res.redirect('/change-password');
  }
  next();
}

/** Only admin-level roles (super_admin, admin_rrhh) */
function requireAdmin(req, res, next) {
  if (!req.session?.userId) {
    if (_isApi(req)) return res.status(401).json({ error: 'No autenticado.' });
    return res.redirect('/login');
  }
  const role = req.session.userRole || req.session.roleName;
  const isAdmin = ['super_admin', 'admin_rrhh', 'admin'].includes(role);
  if (!isAdmin) {
    if (_isApi(req)) return res.status(403).json({ error: 'Acceso denegado.', code: 'NOT_ADMIN' });
    return res.redirect(getDashboard(role));
  }
  next();
}

/** Super admin only */
function requireSuperAdmin(req, res, next) {
  if (!req.session?.userId) {
    if (_isApi(req)) return res.status(401).json({ error: 'No autenticado.' });
    return res.redirect('/login');
  }
  const role = req.session.roleName || req.session.userRole;
  if (role !== 'super_admin') {
    if (_isApi(req)) return res.status(403).json({ error: 'Solo el Super Admin puede acceder.', code: 'NOT_SUPER_ADMIN' });
    return res.redirect('/admin/dashboard');
  }
  next();
}

/** Employee-level access (all roles can access their own portal) */
function requireEmployee(req, res, next) {
  if (!req.session?.userId) {
    if (_isApi(req)) return res.status(401).json({ error: 'No autenticado.' });
    return res.redirect('/login');
  }
  next();
}

/** Redirect logged-in users away from guest pages */
function requireGuest(req, res, next) {
  if (req.session?.userId) {
    const role = req.session.roleName || req.session.userRole;
    return res.redirect(getDashboard(role));
  }
  next();
}

function _isApi(req) {
  return req.path.startsWith('/api') || req.xhr || (req.headers.accept || '').includes('application/json');
}

module.exports = { requireAuth, requireAdmin, requireSuperAdmin, requireEmployee, requireGuest, getDashboard };
