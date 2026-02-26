const { query } = require('../core/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const SALT_ROUNDS = 12;

class UserModel {
  async create({ name, email, password, role = 'employee', roleId = null, primerAcceso = false }) {
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const id = uuidv4();
    const finalRoleId = parseInt(roleId) || 4;
    console.log('DEBUG [User.create] params:', { id, name, email, hashed: '***', role, finalRoleId, primerAcceso });
    await query(
      `INSERT INTO users (id, name, email, password, role, role_id, is_active, primer_acceso, created_at)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, CURRENT_TIMESTAMP)`,
      [id, name.trim(), email.toLowerCase().trim(), hashed, role, finalRoleId, primerAcceso]
    );
    return this.findById(id);
  }

  /** Create employee user with temp password — marks primer_acceso=true */
  async createWithTempPassword({ name, email, roleId = null }) {
    const tempPass = this.generateTempPassword();
    const hashed = await bcrypt.hash(tempPass, SALT_ROUNDS);
    const id = uuidv4();
    const finalRoleId = parseInt(roleId) || 4;
    console.log('DEBUG [User.createWithTempPassword] params:', { id, name, email, hashed: '***', finalRoleId });
    // Store the HASH in temp_password (not plaintext) for security.
    await query(
      `INSERT INTO users (id, name, email, password, role, role_id, is_active, primer_acceso, temp_password, created_at)
       VALUES (?, ?, ?, ?, 'employee', ?, TRUE, TRUE, ?, CURRENT_TIMESTAMP)`,
      [id, name.trim(), email.toLowerCase().trim(), hashed, finalRoleId, hashed]
    );
    return { ...(await this.findById(id)), tempPassword: tempPass };
  }

  generateTempPassword() {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const syms = '@#$!%*?';
    const all = upper + lower + digits + syms;
    const rand = l => Array.from({ length: l }, () => all[Math.floor(Math.random() * all.length)]);
    // Guarantee at least one of each
    const parts = [
      upper[Math.floor(Math.random() * upper.length)],
      digits[Math.floor(Math.random() * digits.length)],
      syms[Math.floor(Math.random() * syms.length)],
      ...rand(9),
    ];
    // Shuffle
    return parts.sort(() => Math.random() - 0.5).join('');
  }

  async findById(id) {
    const rows = await query(
      `SELECT u.*, r.nombre AS role_name FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=$1 LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  async findByEmail(email) {
    const rows = await query(
      `SELECT u.*, r.nombre AS role_name FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.email=$1 LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    return rows[0] || null;
  }

  async verifyPassword(user, password) {
    return bcrypt.compare(password, user.password);
  }

  async updateLastLogin(id) {
    await query(`UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=$1`, [id]);
  }

  async emailExists(email) {
    const rows = await query(`SELECT id FROM users WHERE email=$1 LIMIT 1`, [email.toLowerCase().trim()]);
    return rows.length > 0;
  }

  async setActive(id, isActive) {
    await query(`UPDATE users SET is_active=$1 WHERE id=$2`, [isActive, id]);
  }

  /** Called after successful password change on first login */
  async clearFirstAccess(id) {
    await query(
      `UPDATE users SET primer_acceso=FALSE, temp_password=NULL WHERE id=$1`,
      [id]
    );
  }

  async changePassword(id, newPassword) {
    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await query(`UPDATE users SET password=$1 WHERE id=$2`, [hashed, id]);
  }

  async linkEmployee(userId, employeeId) {
    await query(`UPDATE users SET employee_id=$1 WHERE id=$2`, [employeeId, userId]);
  }

  async updateRoleId(userId, roleId) {
    await query(`UPDATE users SET role_id=$1 WHERE id=$2`, [roleId, userId]);
  }

  async getAllByRole(role) {
    return query(`SELECT id, name, email, is_active, created_at FROM users WHERE role=$1`, [role]);
  }

  async storeRefreshToken(id, token) {
    await query(`UPDATE users SET refresh_token=$1 WHERE id=$2`, [token, id]);
  }

  async clearRefreshToken(id) {
    await query(`UPDATE users SET refresh_token=NULL WHERE id=$1`, [id]);
  }
}

module.exports = new UserModel();
