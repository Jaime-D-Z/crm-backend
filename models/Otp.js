const path = require('path');
const crypto = require('crypto');
const JsonStorage = require('../core/JsonStorage');

const OTP_LENGTH = 6;

class OtpModel {
  constructor() {
    this.db = new JsonStorage(path.join(__dirname, '../storage/otps.json'));
  }

  generate(userId, email, type = 'verification') {
    // Invalidate previous OTPs for this user+type
    this.db.deleteWhere(item => item.userId === userId && item.type === type);

    const code = String(crypto.randomInt(0, 999999)).padStart(OTP_LENGTH, '0');
    const expiryMs = parseInt(process.env.OTP_EXPIRY_MINUTES || '10') * 60 * 1000;

    this.db.insert({
      userId,
      email,
      code,
      type,
      used: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiryMs).toISOString(),
      expiresTimestamp: Date.now() + expiryMs,
    });

    return code;
  }

  verify(userId, code, type = 'verification') {
    const records = this.db.findAll('userId', userId);
    const record = records.find(r => r.type === type && !r.used);

    if (!record) return false;
    if (Date.now() > record.expiresTimestamp) return false;
    if (!crypto.timingSafeEqual(Buffer.from(record.code), Buffer.from(code.padStart(OTP_LENGTH, '0')))) return false;

    this.db.update('id', record.id, { used: true });
    return true;
  }

  cleanExpired() {
    this.db.deleteWhere(item => item.expiresTimestamp < Date.now());
  }
}

module.exports = new OtpModel();
