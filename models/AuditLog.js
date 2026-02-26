const { query } = require('../core/db');

class AuditLogModel {
  async log(userId, action, req, meta = {}) {
    const ip = req?.headers?.['x-forwarded-for']?.split(',')[0]
      || req?.socket?.remoteAddress
      || '0.0.0.0';
    const ua = req?.headers?.['user-agent'] || null;
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, ip, user_agent, meta, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [userId || null, action, ip, ua, meta]
      );
    } catch (e) {
      console.error('AuditLog error:', e.message);
    }
  }

  async getByUser(userId, limit = 50) {
    return query(
      `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
  }

  async getAll(limit = 100) {
    return query(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC LIMIT $1`,
      [limit]
    );
  }

  async getByAction(action, limit = 50) {
    return query(
      `SELECT * FROM audit_logs WHERE action = $1 ORDER BY created_at DESC LIMIT $2`,
      [action, limit]
    );
  }

  async getDuplicateAttempts(limit = 100) {
    return query(
      `SELECT al.*, u.name as admin_name, u.email as admin_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.action IN ('employee_duplicate_attempt', 'employee_create_conflict')
       ORDER BY al.created_at DESC LIMIT $1`,
      [limit]
    );
  }

  async countByAction(action, days = 30) {
    const rows = await query(
      `SELECT COUNT(*) as total FROM audit_logs
       WHERE action = $1 AND created_at >= (CURRENT_TIMESTAMP - INTERVAL '1 day' * $2)`,
      [action, days]
    );
    return rows[0]?.total || 0;
  }
}

module.exports = new AuditLogModel();
