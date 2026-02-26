const Employee = require('../models/Employee');
const { Parser } = require('json2csv');

async function exportEmployeesCSV(req, res) {
    try {
        // Restricted to super_admin or admin_rrhh/admin
        const userRole = req.session.role;
        if (!['super_admin', 'admin', 'admin_rrhh'].includes(userRole)) {
            return res.status(403).json({ error: 'No tienes permisos para exportar este reporte.' });
        }

        const employees = await Employee.getAll({});

        const fields = [
            { label: 'Nombre', value: 'name' },
            { label: 'Email', value: 'email' },
            { label: 'Teléfono', value: 'phone' },
            { label: 'Tipo', value: 'employee_type' },
            { label: 'Departamento', value: 'department' },
            { label: 'Cargo', value: 'position' },
            { label: 'Fecha Ingreso', value: 'hire_date' },
            { label: 'Estado', value: 'status' }
        ];

        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(employees);

        res.header('Content-Type', 'text/csv');
        res.attachment(`reporte_empleados_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (err) {
        console.error('Export CSV error:', err);
        res.status(500).json({ error: 'Error al generar el reporte CSV.' });
    }
}

module.exports = {
    exportEmployeesCSV
};
