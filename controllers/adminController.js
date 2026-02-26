const Employee = require('../models/Employee');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const AuditDuplicate = require('../models/AuditDuplicate');
const { sendWelcomeEmail } = require('../core/mailer');
const { body, validationResult } = require('express-validator');
const levenshtein = require('fast-levenshtein');
const path = require('path');
const fs = require('fs');
const { query } = require('../core/db');

// ── Levenshtein similarity (%) ────────────────────────────
function similarity(a, b) {
    if (!a || !b) return 0;
    const s1 = a.toLowerCase().trim();
    const s2 = b.toLowerCase().trim();
    if (s1 === s2) return 100;
    const dist = levenshtein.get(s1, s2);
    const maxLen = Math.max(s1.length, s2.length);
    return maxLen ? Math.round((1 - dist / maxLen) * 100) : 0;
}

function maxSimilarity(newName, newEmail, existingList) {
    let best = { score: 0, emp: null };
    for (const emp of existingList) {
        const nameSim = similarity(newName, emp.name);
        const emailSim = similarity(newEmail, emp.email);
        const score = Math.max(nameSim, emailSim);
        if (score > best.score) best = { score, emp };
    }
    return best;
}

// ── GET /api/admin/dashboard ──────────────────────────────
async function dashboard(req, res) {
    try {
        const totalEmployees = await Employee.countTotal();
        const byType = await Employee.countByType();
        const recent = await Employee.recentlyAdded(5);
        const recentLogs = await AuditLog.getAll(10);

        // Security indicators for RRHH
        const [{ failed_attempts }] = await query(
            `SELECT COUNT(*) as failed_attempts FROM registro_auditoria WHERE accion IN ('bloqueado', 'advertencia_cancelada')`
        );
        const [{ affected_employees }] = await query(
            `SELECT COUNT(DISTINCT email_nuevo) as affected_employees FROM registro_auditoria`
        );

        const failedAttempts = parseInt(failed_attempts);
        const affectedEmployees = parseInt(affected_employees);

        const typesMap = { instructor: 0, developer: 0, administrator: 0, assistant: 0, other: 0 };
        for (const row of byType) typesMap[row.employee_type] = parseInt(row.total);

        res.json({
            ok: true,
            stats: {
                total: totalEmployees,
                byType: typesMap,
                security: { failedAttempts, affectedEmployees }
            },
            recent,
            logs: recentLogs
        });
    } catch (err) {
        console.error('Admin dashboard error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── GET /api/admin/employees ──────────────────────────────
async function listEmployees(req, res) {
    try {
        const { type, status, search } = req.query;
        const employees = await Employee.getAll({ type, status, search });
        res.json({ ok: true, employees });
    } catch (err) {
        console.error('Error in administrative controller:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── GET /api/admin/employees/:id ──────────────────────────
async function getEmployee(req, res) {
    try {
        const emp = await Employee.findById(req.params.id);
        if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });
        res.json({ ok: true, employee: emp });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── POST /api/admin/employees ─────────────────────────────
const createValidators = [
    body('name').trim().isLength({ min: 2 }).withMessage('Nombre: mínimo 2 caracteres.'),
    body('email').isEmail().withMessage('Correo electrónico inválido.'),
    body('employeeType').notEmpty().withMessage('Tipo de empleado requerido.'),
];

async function createEmployee(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array().map(e => e.msg) });

    const {
        name, email, phone, employeeType, department, position,
        hireDate, status, bio, password, roleId, crearAcceso,
        duplicateConfirmed,
    } = req.body;

    try {
        // ── Check if email exists in users table first ───────
        const emailTaken = await User.emailExists(email);
        if (emailTaken) {
            return res.status(400).json({ error: 'El correo electrónico ya está registrado por otro usuario o empleado.' });
        }

        // ── Duplicate detection (Levenshtein) ─────────────────
        const allEmployees = await Employee.getAll({});
        const { score, emp: similar } = maxSimilarity(name, email, allEmployees);

        if (score >= 50 && !duplicateConfirmed) {
            const isHardBlock = score >= 75;
            await AuditDuplicate.record({
                adminId: req.session.userId,
                nombreNuevo: name,
                emailNuevo: email,
                nombreSimilar: similar?.name,
                emailSimilar: similar?.email,
                similitud: score,
                accion: isHardBlock ? 'bloqueado_previo' : 'advertencia',
            });

            return res.json({
                ok: true,
                warning: 'duplicate_warning',
                severity: isHardBlock ? 'high' : 'medium',
                message: `Se detectó un empleado ${isHardBlock ? 'muy similar' : 'similar'} (${score}%): ${similar?.name} (${similar?.email}).`,
                similar: { name: similar?.name, email: similar?.email, similarity: score },
            });
        }

        // Registrar que fue aceptado tras advertencia
        if (score >= 50 && duplicateConfirmed) {
            await AuditDuplicate.record({
                adminId: req.session.userId,
                nombreNuevo: name,
                emailNuevo: email,
                nombreSimilar: similar?.name,
                emailSimilar: similar?.email,
                similitud: score,
                accion: 'advertencia_aceptada',
            });
        }

        // ── Create employee record ────────────────────────────
        const employee = await Employee.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone || null,
            employeeType,
            department: department || null,
            position: position || null,
            hireDate: hireDate || null,
            status: status || 'active',
            bio: bio || null,
            createdBy: req.session.userId,
        });

        let tempPassword = null;

        // ── Optionally create user account ────────────────────
        if (crearAcceso === 'true' || crearAcceso === true || password) {
            const emailExists = await User.emailExists(email.toLowerCase());
            if (!emailExists) {
                let userRecord;

                if (password && password.length >= 8) {
                    // Admin provided manual password
                    userRecord = await User.create({
                        name: name.trim(),
                        email: email.toLowerCase(),
                        password,
                        role: 'employee',
                        roleId: (roleId && !isNaN(parseInt(roleId))) ? parseInt(roleId) : 4,
                        primerAcceso: false,
                    });
                } else {
                    // Auto-generate temp password
                    userRecord = await User.createWithTempPassword({
                        name: name.trim(),
                        email: email.toLowerCase(),
                        roleId: (roleId && !isNaN(parseInt(roleId))) ? parseInt(roleId) : 4,
                    });
                    tempPassword = userRecord.tempPassword;
                }

                await Employee.linkUser(employee.id, userRecord.id);
                await User.linkEmployee(userRecord.id, employee.id);

                // Send welcome email (non-blocking)
                if (tempPassword) {
                    sendWelcomeEmail({ name: name.trim(), email: email.toLowerCase(), tempPassword })
                        .then(() => console.log(`✉ Welcome email sent to ${email}`))
                        .catch(err => console.error('Welcome email error:', err.message));
                }
            }
        }

        await AuditLog.log(req.session.userId, 'employee_created', req, {
            employeeId: employee.id, employeeName: employee.name, empleadoEmail: employee.email,
        });

        res.status(201).json({
            ok: true, employee,
            message: `Empleado ${employee.name} registrado.` + (tempPassword ? ' Se envió el email de bienvenida.' : ''),
            emailSent: !!tempPassword,
        });
    } catch (err) {
        console.error('Create employee error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── POST /api/admin/employees/:id/photo ──────────────────
async function uploadPhoto(req, res) {
    if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo.' });

    const empId = req.params.id;
    const photoUrl = `/uploads/empleados/${req.file.filename}`;

    try {
        const emp = await Employee.findById(empId);
        if (!emp) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Empleado no encontrado.' });
        }

        // Delete old photo
        if (emp.photo_url) {
            const oldPath = path.join(__dirname, '..', emp.photo_url);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        await query(`UPDATE employees SET photo_url=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2`, [photoUrl, empId]);
        await AuditLog.log(req.session.userId, 'employee_photo_updated', req, { empId, photoUrl });

        res.json({ ok: true, photoUrl, message: 'Foto actualizada.' });
    } catch (err) {
        console.error('uploadPhoto error:', err);
        res.status(500).json({ error: 'Error del servidor.' });
    }
}

// ── PUT /api/admin/employees/:id ──────────────────────────
async function updateEmployee(req, res) {
    try {
        const emp = await Employee.findById(req.params.id);
        if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });

        const updated = await Employee.update(req.params.id, req.body);
        await AuditLog.log(req.session.userId, 'employee_updated', req, {
            employeeId: req.params.id, changes: Object.keys(req.body),
        });

        res.json({ ok: true, employee: updated, message: 'Empleado actualizado.' });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── GET /api/admin/audit ──────────────────────────────────
async function getAuditLogs(req, res) {
    try {
        const logs = await AuditLog.getAll(200);
        const duplicates = (await AuditDuplicate.getAll({})).rows;
        const totalDuplicates = duplicates.length;
        res.json({ ok: true, logs, duplicates, totalDuplicates });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── GET /api/admin/audit/duplicates ──────────────────────
async function getDuplicates(req, res) {
    try {
        const result = await AuditDuplicate.getAll(req.query);
        res.json({ ok: true, ...result });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── GET /api/admin/config ────────────────────────────────
async function getConfig(req, res) {
    try {
        const rows = await query('SELECT * FROM config_global ORDER BY key_name ASC');
        res.json({ ok: true, config: rows });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── PUT /api/admin/config/:key ────────────────────────────
async function updateConfig(req, res) {
    try {
        const { value } = req.body;
        const { key } = req.params;
        await query('UPDATE config_global SET value_content = $1 WHERE key_name = $2', [value, key]);
        await AuditLog.log(req.session.userId, 'config_updated', req, { key, value });
        res.json({ ok: true, message: `Configuración ${key} actualizada.` });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── DELETE /api/admin/employees/:id ──────────────────────
async function deleteEmployee(req, res) {
    try {
        const emp = await Employee.findById(req.params.id);
        if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });

        if (emp.user_id) {
            await User.setActive(emp.user_id, false);
        }

        await query('DELETE FROM employees WHERE id = $1', [req.params.id]);
        await AuditLog.log(req.session.userId, 'employee_deleted', req, {
            employeeId: req.params.id, employeeName: emp.name
        });

        res.json({ ok: true, message: 'Empleado eliminado correctamente.' });
    } catch (err) {
        console.error('deleteEmployee error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
}

module.exports = {
    dashboard, listEmployees, getEmployee, createEmployee,
    updateEmployee, uploadPhoto, getAuditLogs, getDuplicates,
    deleteEmployee, getConfig, updateConfig, createValidators,
};
