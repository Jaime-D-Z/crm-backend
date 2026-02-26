const { query } = require('../core/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Compute objective estado automatically based on avance + fecha_limite
 */
function computeEstado(avance, fechaLimite) {
    const now = new Date();
    const limit = new Date(fechaLimite);
    if (avance >= 100) return 'completado';
    if (avance > 0 && now <= limit) return 'en_progreso';
    if (now > limit && avance < 100) return 'vencido';
    return 'pendiente';
}

class ObjectiveModel {
    async create({ employeeId, adminId, titulo, descripcion, fechaLimite, avance = 0 }) {
        const id = uuidv4();
        const estado = computeEstado(avance, fechaLimite);
        await query(
            `INSERT INTO objetivos (id, employee_id, admin_id, titulo, descripcion, fecha_limite, avance, estado, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP)`,
            [id, employeeId, adminId, titulo.trim(), descripcion || null, fechaLimite, avance, estado]
        );
        return this.findById(id);
    }

    async findById(id) {
        const rows = await query(
            `SELECT o.*, e.name AS employee_name, e.employee_type, u.name AS admin_name
       FROM objetivos o
       LEFT JOIN employees e ON e.id = o.employee_id
       LEFT JOIN users u ON u.id = o.admin_id
       WHERE o.id = $1`,
            [id]
        );
        return rows[0] || null;
    }

    async getByEmployee(employeeId) {
        // First auto-update vencidos
        await this._autoUpdateVencidos();
        return query(
            `SELECT o.*, u.name AS admin_name
       FROM objetivos o
       LEFT JOIN users u ON u.id = o.admin_id
       WHERE o.employee_id = $1
       ORDER BY o.fecha_limite ASC`,
            [employeeId]
        );
    }

    async getAll({ employeeId, estado, search } = {}) {
        await this._autoUpdateVencidos();
        let sql = `
      SELECT o.*, e.name AS employee_name, e.employee_type, u.name AS admin_name
      FROM objetivos o
      LEFT JOIN employees e ON e.id = o.employee_id
      LEFT JOIN users u ON u.id = o.admin_id
      WHERE 1=1
    `;
        const params = [];
        let index = 1;
        if (employeeId) { sql += ` AND o.employee_id = $${index++}`; params.push(employeeId); }
        if (estado) { sql += ` AND o.estado = $${index++}`; params.push(estado); }
        if (search) { sql += ` AND (o.titulo ILIKE $${index} OR e.name ILIKE $${index})`; params.push(`%${search}%`); }
        sql += ` ORDER BY o.fecha_limite ASC`;
        return query(sql, params);
    }

    async updateProgress(id, avance) {
        const obj = await this.findById(id);
        if (!obj) return null;
        const estado = computeEstado(avance, obj.fecha_limite);
        await query(
            `UPDATE objetivos SET avance=$1, estado=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3`,
            [avance, estado, id]
        );
        return this.findById(id);
    }

    async getSummaryByEstado() {
        return query(`
      SELECT estado, COUNT(*) AS total
      FROM objetivos
      GROUP BY estado
    `);
    }

    async _autoUpdateVencidos() {
        // Auto-mark overdue objectives
        await query(`
      UPDATE objetivos
      SET estado = 'vencido', updated_at = CURRENT_TIMESTAMP
      WHERE fecha_limite < CURRENT_DATE
        AND avance < 100
        AND estado != 'vencido'
        AND estado != 'completado'
    `);
    }
}

module.exports = new ObjectiveModel();
