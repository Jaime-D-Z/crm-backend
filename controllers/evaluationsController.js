const Evaluation = require('../models/Evaluation');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');
const { body, validationResult } = require('express-validator');

const validators = [
    body('employeeId').notEmpty().withMessage('Empleado requerido.'),
    body('puntaje').isInt({ min: 1, max: 5 }).withMessage('Puntaje debe ser entre 1 y 5.'),
    body('fecha').isISO8601().withMessage('Fecha inválida.'),
];

// POST /api/evaluations
async function create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array().map(e => e.msg) });

    const { employeeId, puntaje, comentario, fecha } = req.body;
    const evaluadorId = req.session.userId;

    try {
        const emp = await Employee.findById(employeeId);
        if (!emp) return res.status(404).json({ error: 'Empleado no encontrado.' });

        const evaluation = await Evaluation.create({ employeeId, evaluadorId, puntaje: parseInt(puntaje), comentario, fecha });
        await AuditLog.log(evaluadorId, 'evaluation_created', req, { employeeId, puntaje });

        res.status(201).json({ ok: true, evaluation, message: 'Evaluación registrada.' });
    } catch (err) {
        console.error('create evaluation error:', err);
        res.status(500).json({ error: 'Error del servidor.' });
    }
}

// GET /api/evaluations/:employeeId
async function getByEmployee(req, res) {
    try {
        const evaluations = await Evaluation.getByEmployee(req.params.employeeId);
        res.json({ ok: true, evaluations });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor.' });
    }
}

// GET /api/evaluations/summary
async function getSummary(req, res) {
    try {
        const stats = await Evaluation.getSummaryStats();
        res.json({ ok: true, stats });
    } catch (err) {
        console.error('getSummary error:', err);
        res.status(500).json({ error: 'Error del servidor.' });
    }
}

module.exports = { create, getByEmployee, getSummary, validators };
