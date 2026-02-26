const { query } = require('../core/db');
const { v4: uuidv4 } = require('uuid');

class EmployeeModel {
    async create({ name, email, phone, employeeType, department, position, hireDate, status, photoUrl, bio, createdBy }) {
        const id = uuidv4();
        await query(
            `INSERT INTO employees
         (id, name, email, phone, employee_type, department, position, hire_date, status, photo_url, bio, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)`,
            [id, name, email, phone || null, employeeType, department || null, position || null,
                hireDate || null, status || 'active', photoUrl || null, bio || null, createdBy]
        );
        return this.findById(id);
    }

    async findById(id) {
        const rows = await query('SELECT * FROM employees WHERE id = $1 LIMIT 1', [id]);
        return rows[0] || null;
    }

    async findByEmail(email) {
        const rows = await query('SELECT * FROM employees WHERE email = $1 LIMIT 1', [email.toLowerCase().trim()]);
        return rows[0] || null;
    }

    async getAll({ type, status, search } = {}) {
        let sql = 'SELECT * FROM employees WHERE 1=1';
        const params = [];
        let index = 1;
        if (type) { sql += ` AND employee_type = $${index++}`; params.push(type); }
        if (status) { sql += ` AND status = $${index++}`; params.push(status); }
        if (search) {
            sql += ` AND (name ILIKE $${index} OR email ILIKE $${index} OR position ILIKE $${index})`;
            params.push(`%${search}%`);
        }
        sql += ' ORDER BY created_at DESC';
        return query(sql, params);
    }

    async update(id, fields) {
        const allowed = ['name', 'email', 'phone', 'employee_type', 'department', 'position', 'hire_date', 'status', 'photo_url', 'bio'];
        const sets = [];
        const vals = [];
        for (const [k, v] of Object.entries(fields)) {
            const col = k.replace(/([A-Z])/g, '_$1').toLowerCase();
            if (allowed.includes(col)) {
                sets.push(`${col} = ?`);
                vals.push(v);
            }
        }
        if (!sets.length) return;
        vals.push(id);
        const pgSets = sets.map((s, i) => s.replace('?', `$${i + 1}`));
        await query(`UPDATE employees SET ${pgSets.join(', ')} WHERE id = $${vals.length}`, vals);
        return this.findById(id);
    }

    async linkUser(employeeId, userId) {
        await query('UPDATE employees SET user_id = $1 WHERE id = $2', [userId, employeeId]);
    }

    async countByType() {
        return query(
            `SELECT employee_type, COUNT(*) as total FROM employees
       WHERE status = 'active' GROUP BY employee_type`
        );
    }

    async countTotal() {
        const rows = await query('SELECT COUNT(*) as total FROM employees');
        return rows[0].total;
    }

    async recentlyAdded(limit = 5) {
        return query(
            'SELECT * FROM employees ORDER BY created_at DESC LIMIT $1',
            [limit]
        );
    }
}

module.exports = new EmployeeModel();
