const Permission = require('../models/Permission');
const AuditLog = require('../models/AuditLog');

/**
 * Middleware factory: checkPermission('RRHH', 'crear')
 * Requires session.roleId to be set by requireAuth first.
 */
function checkPermission(modulo, accion) {
    return async (req, res, next) => {
        const roleId = req.session?.roleId;

        if (!roleId) {
            await _logUnauthorized(req, modulo, accion, 'no_role_id');
            return _deny(req, res, modulo, accion);
        }

        try {
            const granted = await Permission.check(roleId, modulo, accion);
            if (!granted) {
                await _logUnauthorized(req, modulo, accion, 'permission_denied');
                return _deny(req, res, modulo, accion);
            }
            next();
        } catch (err) {
            console.error('checkPermission error:', err.message);
            res.status(500).json({ error: 'Error verificando permisos.' });
        }
    };
}

function _deny(req, res, modulo, accion) {
    if (req.path.startsWith('/api') || req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
            error: `Acceso denegado. No tienes permiso para: ${modulo} > ${accion}`,
            code: 'PERMISSION_DENIED',
        });
    }
    return res.status(403).sendFile(
        require('path').join(__dirname, '../views/403.html')
    );
}

async function _logUnauthorized(req, modulo, accion, reason) {
    try {
        await AuditLog.log(req.session?.userId || null, 'unauthorized_access', req, {
            modulo, accion, reason, path: req.path,
        });
    } catch { }
}

module.exports = { checkPermission };
