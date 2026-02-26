const { query } = require('../core/db');
const crypto = require('crypto');

class LoginIntentoModel {
    /** Record a failed login attempt. Returns current count. */
    async record(ip, email) {
        const existing = await query(
            `SELECT id, intentos, bloqueado_hasta FROM login_intentos WHERE ip=$1 AND email=$2 LIMIT 1`,
            [ip, (email || '').toLowerCase()]
        );

        if (!existing.length) {
            await query(
                `INSERT INTO login_intentos (ip, email, intentos, ultimo_intento) VALUES ($1,$2,1,CURRENT_TIMESTAMP)`,
                [ip, (email || '').toLowerCase()]
            );
            return 1;
        }

        const row = existing[0];
        const nuevo = (row.intentos || 0) + 1;
        const bloquear = nuevo >= 5;

        await query(
            `UPDATE login_intentos
       SET intentos=$1, bloqueado_hasta=$2, ultimo_intento=CURRENT_TIMESTAMP
       WHERE id=$3`,
            [
                nuevo,
                bloquear ? new Date(Date.now() + 15 * 60 * 1000) : null,
                row.id,
            ]
        );
        return nuevo;
    }

    /** Check if IP+email is currently blocked. Returns null or { blocked, remaining } */
    async isBlocked(ip, email) {
        const rows = await query(
            `SELECT intentos, bloqueado_hasta FROM login_intentos WHERE ip=$1 AND email=$2 LIMIT 1`,
            [ip, (email || '').toLowerCase()]
        );
        if (!rows.length) return null;

        const { intentos, bloqueado_hasta } = rows[0];
        if (!bloqueado_hasta) return null;

        const now = new Date();
        const unlock = new Date(bloqueado_hasta);
        if (now < unlock) {
            const remaining = Math.ceil((unlock - now) / 60000); // minutes
            return { blocked: true, intentos, remaining, unlockAt: unlock };
        }
        // Expired block — clear it
        await this.clear(ip, email);
        return null;
    }

    /** Clear attempts for an IP+email after successful login */
    async clear(ip, email) {
        await query(
            `DELETE FROM login_intentos WHERE ip=$1 AND email=$2`,
            [ip, (email || '').toLowerCase()]
        );
    }
}

module.exports = new LoginIntentoModel();
