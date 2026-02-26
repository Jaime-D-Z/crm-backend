const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');

// GET /api/employee/dashboard
async function dashboard(req, res) {
    try {
        const userId = req.session.userId;
        // Find employee record linked to this user
        const rows = await require('../core/db').query(
            `SELECT e.* FROM employees e
       INNER JOIN users u ON u.employee_id = e.id
       WHERE u.id = ? LIMIT 1`,
            [userId]
        );
        const employee = rows[0] || null;
        const logs = await AuditLog.getByUser(userId, 20);

        res.json({
            ok: true,
            user: {
                id: userId,
                name: req.session.userName,
                email: req.session.userEmail,
                role: req.session.userRole,
            },
            employee,
            logs,
        });
    } catch (err) {
        console.error('Employee dashboard error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
}

module.exports = { dashboard };
