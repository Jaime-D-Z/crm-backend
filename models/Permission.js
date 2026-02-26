const { query } = require('../core/db');

class PermissionModel {
    /** Get all permissions for a role_id as a Set of "modulo:accion" strings */
    async getByRole(roleId) {
        const rows = await query(
            `SELECT p.modulo, p.accion
       FROM roles_permisos rp
       JOIN permisos p ON p.id = rp.permiso_id
       WHERE rp.role_id = $1`,
            [roleId]
        );
        return new Set(rows.map(r => `${r.modulo}:${r.accion}`));
    }

    /** Check single permission */
    async check(roleId, modulo, accion) {
        if (!roleId) return false;
        const rows = await query(
            `SELECT 1 FROM roles_permisos rp
       JOIN permisos p ON p.id = rp.permiso_id
       WHERE rp.role_id = $1 AND p.modulo = $2 AND p.accion = $3
       LIMIT 1`,
            [roleId, modulo, accion]
        );
        return rows.length > 0;
    }

    /** For the permissions management panel — full matrix */
    async getMatrix() {
        const roles = await query(`SELECT id, nombre, descripcion FROM roles ORDER BY id`);
        const permisos = await query(`SELECT id, modulo, accion, label FROM permisos ORDER BY modulo, accion`);
        const assigned = await query(`SELECT role_id, permiso_id FROM roles_permisos`);

        const assignedSet = new Set(assigned.map(r => `${r.role_id}:${r.permiso_id}`));
        return { roles, permisos, assignedSet: [...assignedSet] };
    }

    /** Toggle a permission (returns new state) */
    async toggle(roleId, permisoId) {
        const exists = await query(
            `SELECT 1 FROM roles_permisos WHERE role_id=$1 AND permiso_id=$2 LIMIT 1`,
            [roleId, permisoId]
        );
        if (exists.length) {
            await query(`DELETE FROM roles_permisos WHERE role_id=$1 AND permiso_id=$2`, [roleId, permisoId]);
            return false;
        } else {
            await query(`INSERT INTO roles_permisos (role_id, permiso_id) VALUES ($1,$2)`, [roleId, permisoId]);
            return true;
        }
    }

    /** Bulk update permissions for a role */
    async bulkUpdate(roleId, permisoIds) {
        await query(`DELETE FROM roles_permisos WHERE role_id=$1`, [roleId]);
        for (const pid of permisoIds) {
            await query(`INSERT INTO roles_permisos (role_id, permiso_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [roleId, pid]);
        }
        return true;
    }
}

module.exports = new PermissionModel();
