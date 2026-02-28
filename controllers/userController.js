const User = require('../models/User');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');
const { sendWelcomeEmail } = require('../core/mailer');
const { body, validationResult } = require('express-validator');
const { query } = require('../core/db');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ── GET /api/users ────────────────────────────────────────
async function listUsers(req, res) {
    try {
        const { search, role, status, page = 1, limit = 10 } = req.query;
        
        let sql = `
            SELECT u.id, u.name, u.email, u.role, u.role_id, u.is_active as status, 
                   u.phone, u.department, u.position, u.created_at, u.last_login,
                   r.nombre AS roleName, r.nombre AS userRole
            FROM users u 
            LEFT JOIN roles r ON r.id = u.role_id 
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (search) {
            sql += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.position ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (role) {
            sql += ` AND u.role = $${paramIndex}`;
            params.push(role);
            paramIndex++;
        }

        if (status) {
            const isActive = status === 'active';
            sql += ` AND u.is_active = $${paramIndex}`;
            params.push(isActive);
            paramIndex++;
        }

        // Count total
        const countSql = `SELECT COUNT(*) as total FROM (${sql}) as filtered`;
        const [{ total }] = await query(countSql, params);

        // Pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), offset);

        const users = await query(sql, params);

        // Map status
        const mappedUsers = users.map(u => ({
            ...u,
            status: u.status ? 'active' : 'inactive'
        }));

        res.json({
            ok: true,
            users: mappedUsers,
            pagination: {
                total: parseInt(total),
                pages: Math.ceil(total / limit),
                current: parseInt(page)
            }
        });
    } catch (err) {
        console.error('listUsers error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── POST /api/users ───────────────────────────────────────
const createValidators = [
    body('name').trim().isLength({ min: 3 }).withMessage('El nombre debe tener al menos 3 caracteres'),
    body('email').isEmail().withMessage('Email inválido'),
    body('password').optional().isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
    body('roleId').notEmpty().withMessage('Debe seleccionar un rol'),
];

async function createUser(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array().map(e => e.msg) });
    }

    const {
        name, email, password, roleId, status = 'active',
        phone, department, position, photo_url_base64
    } = req.body;

    try {
        // Check if email already exists
        const emailTaken = await User.emailExists(email);
        if (emailTaken) {
            return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
        }

        // Process face photo if provided (simple image save, no face recognition yet)
        let savedPhotoUrl = null;

        if (photo_url_base64) {
            try {
                // Save image directly without face recognition
                const base64Data = photo_url_base64.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, 'base64');
                const filename = `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.jpg`;
                const uploadPath = path.join(__dirname, '..', 'public', 'uploads', 'users');

                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }

                fs.writeFileSync(path.join(uploadPath, filename), buffer);
                savedPhotoUrl = `/uploads/users/${filename}`;
                console.log(`✅ Foto guardada: ${savedPhotoUrl}`);
            } catch (errorPhoto) {
                console.error("Error guardando foto:", errorPhoto);
                return res.status(400).json({ error: 'Error al guardar la imagen. Intenta con otra foto.' });
            }
        }

        let user;
        let tempPassword = null;

        // Create user with password or temp password
        if (password && password.length >= 8) {
            user = await User.create({
                name: name.trim(),
                email: email.toLowerCase().trim(),
                password,
                role: 'employee',
                roleId: parseInt(roleId),
                primerAcceso: false,
            });
        } else {
            user = await User.createWithTempPassword({
                name: name.trim(),
                email: email.toLowerCase().trim(),
                roleId: parseInt(roleId),
            });
            tempPassword = user.tempPassword;
        }

        // Update additional fields (without face_descriptor for now)
        await query(
            `UPDATE users SET phone=$1, department=$2, position=$3, is_active=$4, photo_url=$5 WHERE id=$6`,
            [phone || null, department || null, position || null, status === 'active', savedPhotoUrl, user.id]
        );

        // Send welcome email if temp password was generated
        if (tempPassword) {
            sendWelcomeEmail({ name: name.trim(), email: email.toLowerCase(), tempPassword })
                .then(() => console.log(`✉ Welcome email sent to ${email}`))
                .catch(err => console.error('Welcome email error:', err.message));
        }

        await AuditLog.log(req.session.userId, 'user_created', req, {
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
        });

        res.status(201).json({
            ok: true,
            user,
            message: `Usuario ${user.name} creado correctamente` + (tempPassword ? '. Se envió el email de bienvenida.' : ''),
            emailSent: !!tempPassword,
        });
    } catch (err) {
        console.error('createUser error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── PUT /api/users/:id ────────────────────────────────────
async function updateUser(req, res) {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const {
            name, email, password, roleId, status,
            phone, department, position, photo_url_base64
        } = req.body;

        // Check if email is taken by another user
        if (email && email.toLowerCase() !== user.email.toLowerCase()) {
            const emailTaken = await User.emailExists(email);
            if (emailTaken) {
                return res.status(400).json({ error: 'El correo electrónico ya está registrado por otro usuario' });
            }
        }

        // Process face photo if provided (simple image save)
        let savedPhotoUrl = user.photo_url;

        if (photo_url_base64) {
            try {
                // Delete old photo if exists
                if (user.photo_url) {
                    const oldPath = path.join(__dirname, '..', 'public', user.photo_url);
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }

                // Save new image
                const base64Data = photo_url_base64.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, 'base64');
                const filename = `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.jpg`;
                const uploadPath = path.join(__dirname, '..', 'public', 'uploads', 'users');

                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }

                fs.writeFileSync(path.join(uploadPath, filename), buffer);
                savedPhotoUrl = `/uploads/users/${filename}`;
                console.log(`✅ Foto actualizada: ${savedPhotoUrl}`);
            } catch (errorPhoto) {
                console.error("Error guardando foto:", errorPhoto);
                return res.status(400).json({ error: 'Error al guardar la imagen' });
            }
        }

        // Update user
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (name) {
            updates.push(`name = $${paramIndex++}`);
            params.push(name.trim());
        }

        if (email) {
            updates.push(`email = $${paramIndex++}`);
            params.push(email.toLowerCase().trim());
        }

        if (password) {
            const bcrypt = require('bcrypt');
            const hashed = await bcrypt.hash(password, 12);
            updates.push(`password = $${paramIndex++}`);
            params.push(hashed);
            updates.push(`primer_acceso = FALSE, temp_password = NULL`);
        }

        if (roleId) {
            updates.push(`role_id = $${paramIndex++}`);
            params.push(parseInt(roleId));
        }

        if (status !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            params.push(status === 'active');
        }

        if (phone !== undefined) {
            updates.push(`phone = $${paramIndex++}`);
            params.push(phone || null);
        }

        if (department !== undefined) {
            updates.push(`department = $${paramIndex++}`);
            params.push(department || null);
        }

        if (position !== undefined) {
            updates.push(`position = $${paramIndex++}`);
            params.push(position || null);
        }

        if (savedPhotoUrl !== user.photo_url) {
            updates.push(`photo_url = $${paramIndex++}`);
            params.push(savedPhotoUrl);
        }

        if (updates.length > 0) {
            params.push(userId);
            await query(
                `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`,
                params
            );
        }

        await AuditLog.log(req.session.userId, 'user_updated', req, {
            userId,
            changes: Object.keys(req.body),
        });

        const updatedUser = await User.findById(userId);
        res.json({ ok: true, user: updatedUser, message: 'Usuario actualizado correctamente' });
    } catch (err) {
        console.error('updateUser error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── DELETE /api/users/:id ─────────────────────────────────
async function deleteUser(req, res) {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Don't allow deleting yourself
        if (userId === req.session.userId) {
            return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
        }

        // Delete photo if exists
        if (user.photo_url) {
            const photoPath = path.join(__dirname, '..', 'public', user.photo_url);
            if (fs.existsSync(photoPath)) {
                fs.unlinkSync(photoPath);
            }
        }

        // Soft delete - set inactive
        await User.setActive(userId, false);

        await AuditLog.log(req.session.userId, 'user_deleted', req, {
            userId,
            userName: user.name,
            userEmail: user.email,
        });

        res.json({ ok: true, message: 'Usuario eliminado correctamente' });
    } catch (err) {
        console.error('deleteUser error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── PATCH /api/users/:id/status ───────────────────────────
async function toggleStatus(req, res) {
    try {
        const userId = req.params.id;
        const { status } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        await User.setActive(userId, status === 'active');

        await AuditLog.log(req.session.userId, 'user_status_changed', req, {
            userId,
            newStatus: status,
        });

        res.json({ ok: true, message: `Usuario ${status === 'active' ? 'activado' : 'desactivado'} correctamente` });
    } catch (err) {
        console.error('toggleStatus error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
}

// ── POST /api/users/:id/reset-password ────────────────────
async function resetPassword(req, res) {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const tempPassword = User.generateTempPassword();
        const bcrypt = require('bcrypt');
        const hashed = await bcrypt.hash(tempPassword, 12);

        await query(
            `UPDATE users SET password=$1, temp_password=$2, primer_acceso=TRUE WHERE id=$3`,
            [hashed, hashed, userId]
        );

        // Send email
        sendWelcomeEmail({ name: user.name, email: user.email, tempPassword })
            .then(() => console.log(`✉ Password reset email sent to ${user.email}`))
            .catch(err => console.error('Password reset email error:', err.message));

        await AuditLog.log(req.session.userId, 'user_password_reset', req, { userId });

        res.json({ ok: true, message: 'Se ha enviado un correo con la nueva contraseña temporal' });
    } catch (err) {
        console.error('resetPassword error:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
}

module.exports = {
    listUsers,
    createUser,
    updateUser,
    deleteUser,
    toggleStatus,
    resetPassword,
    createValidators,
};
