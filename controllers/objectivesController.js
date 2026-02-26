const Objective = require('../models/Objective');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');
const { body, validationResult } = require('express-validator');

const validators = [
    body('employeeId').notEmpty().withMessage('Empleado requerido.'),
    body('titulo').trim().isLength({ min: 3 }).withMessage('Título: mínimo 3 caracteres.'),
    body('fechaLimite').isISO8601().withMessage('Fecha límite inválida.'),
    body('avance').optional().isInt({ min: 0, max: 100 }).withMessage('Avance: 0-100.'),
];

// POST /api/objectives
async function create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array().map(e => e.msg) });

    const { employeeId, titulo, descripcion, fechaLimite, avance = 0 } = req.body;
    const adminId = req.session.userId;

    try {
        const emp = await Employee.findById(employeeId);
        if (!emp) return res.status(404).json({ error: 'Empleado no encontrado.' });

        const obj = await Objective.create({ employeeId, adminId, titulo, descripcion, fechaLimite, avance: parseInt(avance) });
        await AuditLog.log(adminId, 'objective_created', req, { employeeId, titulo });

        res.status(201).json({ ok: true, objective: obj, message: 'Objetivo creado exitosamente.' });
    } catch (err) {
        console.error('create objective error:', err);
        res.status(500).json({ error: 'Error del servidor.' });
    }
}

// GET /api/objectives?employeeId=&estado=&search=
async function getAll(req, res) {
    try {
        const objectives = await Objective.getAll(req.query);
        const summary = await Objective.getSummaryByEstado();
        res.json({ ok: true, objectives, summary });
    } catch (err) {
        console.error('getAll objectives error:', err);
        res.status(500).json({ error: 'Error del servidor.' });
    }
}

// GET /api/objectives/employee/:employeeId
async function getByEmployee(req, res) {
    try {
        const objectives = await Objective.getByEmployee(req.params.employeeId);
        res.json({ ok: true, objectives });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor.' });
    }
}

// PATCH /api/objectives/:id/progress
async function updateProgress(req, res) {
    const { avance } = req.body;
    if (avance === undefined || avance < 0 || avance > 100) {
        return res.status(400).json({ error: 'Avance debe ser entre 0 y 100.' });
    }
    try {
        const obj = await Objective.updateProgress(req.params.id, parseInt(avance));
        if (!obj) return res.status(404).json({ error: 'Objetivo no encontrado.' });
        await AuditLog.log(req.session.userId, 'objective_updated', req, { id: req.params.id, avance });
        res.json({ ok: true, objective: obj });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor.' });
    }
}

module.exports = { create, getAll, getByEmployee, updateProgress, validators };
