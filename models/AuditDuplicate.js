const { query } = require('../core/db');

class AuditDuplicateModel {
    async record({ adminId, nombreNuevo, emailNuevo, nombreSimilar, emailSimilar, similitud, accion }) {
        await query(
            `INSERT INTO registro_auditoria
       (admin_id, nombre_nuevo, email_nuevo, nombre_similar, email_similar, similitud, accion, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)`,
            [adminId, nombreNuevo, emailNuevo, nombreSimilar || null, emailSimilar || null, similitud, accion]
        );
    }

    async getAll({ page = 1, perPage = 50, fechaDesde, fechaHasta, similitudMin } = {}) {
        let sql = `SELECT ad.*, u.name AS admin_name FROM registro_auditoria ad LEFT JOIN users u ON u.id=ad.admin_id WHERE 1=1`;
        const params = [];

        if (fechaDesde) { sql += ` AND ad.created_at >= $${params.length + 1}`; params.push(fechaDesde); }
        if (fechaHasta) { sql += ` AND ad.created_at <= $${params.length + 1}`; params.push(fechaHasta + ' 23:59:59'); }
        if (similitudMin) { sql += ` AND ad.similitud >= $${params.length + 1}`; params.push(similitudMin); }

        sql += ` ORDER BY ad.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(perPage, (page - 1) * perPage);

        const rows = await query(sql, params);
        const [{ total }] = await query(
            `SELECT COUNT(*) AS total FROM registro_auditoria ad WHERE 1=1` +
            (fechaDesde ? ` AND ad.created_at >= '${fechaDesde}'` : '') +
            (fechaHasta ? ` AND ad.created_at <= '${fechaHasta} 23:59:59'` : '') +
            (similitudMin ? ` AND ad.similitud >= ${parseFloat(similitudMin)}` : '')
        );

        return { rows, total };
    }

    async exportCsv() {
        return query(
            `SELECT ad.created_at, ad.nombre_nuevo, ad.email_nuevo, ad.nombre_similar,
              ad.email_similar, ad.similitud, ad.accion, u.name AS admin_name
       FROM registro_auditoria ad
       LEFT JOIN users u ON u.id = ad.admin_id
       ORDER BY ad.created_at DESC`
        );
    }
}

module.exports = new AuditDuplicateModel();
