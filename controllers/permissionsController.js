const Permission = require('../models/Permission');
const AuditLog = require('../models/AuditLog');
const { query } = require('../core/db');

// GET /api/permissions/matrix — full RBAC matrix (Super Admin only)
async function getMatrix(req, res) {
    try {
        const matrix = await Permission.getMatrix();
        res.json({ ok: true, ...matrix });
    } catch (err) {
        console.error('getMatrix error:', err);
        res.status(500).json({ error: 'Error del servidor.' });
    }
}

// GET /api/permissions/roles
async function getRoles(req, res) {
    try {
        const roles = await query(`SELECT id, nombre, descripcion FROM roles ORDER BY id`);
        res.json({ ok: true, roles });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor.' });
    }
}

// POST /api/permissions/toggle — Toggle a single permission for a role
async function toggle(req, res) {
    const { roleId, permisoId } = req.body;
    if (!roleId || !permisoId) return res.status(400).json({ error: 'roleId y permisoId son requeridos.' });

    try {
        const granted = await Permission.toggle(parseInt(roleId), parseInt(permisoId));
        await AuditLog.log(req.session.userId, 'permission_toggled', req, { roleId, permisoId, granted });
        res.json({ ok: true, granted });
    } catch (err) {
        console.error('toggle error:', err);
        res.status(500).json({ error: 'Error del servidor.' });
    }
}

// PUT /api/permissions/role/:roleId — bulk-save permissions for a role
async function bulkUpdate(req, res) {
    const { permisoIds } = req.body; // array of permiso IDs to grant
    const roleId = parseInt(req.params.roleId);
    if (!Array.isArray(permisoIds)) return res.status(400).json({ error: 'permisoIds debe ser un array.' });

    try {
        await Permission.bulkUpdate(roleId, permisoIds);
        await AuditLog.log(req.session.userId, 'permissions_bulk_updated', req, { roleId, count: permisoIds.length });
        res.json({ ok: true, message: 'Permisos actualizados.' });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor.' });
    }
}

module.exports = { getMatrix, getRoles, toggle, bulkUpdate };
