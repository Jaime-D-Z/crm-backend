const path = require('path');
const JsonStorage = require('../core/JsonStorage');

class IpAttemptModel {
  constructor() {
    this.db = new JsonStorage(path.join(__dirname, '../storage/ip_attempts.json'));
  }

  _windowStart() {
    const mins = parseInt(process.env.LOCKOUT_MINUTES || '15');
    return Date.now() - mins * 60 * 1000;
  }

  _max() {
    return parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
  }

  record(ip, action) {
    this.db.insert({ ip, action, timestamp: Date.now(), at: new Date().toISOString() });
  }

  isLockedOut(ip, action) {
    const windowStart = this._windowStart();
    const attempts = this.db.all().filter(
      a => a.ip === ip && a.action === action && a.timestamp > windowStart
    );
    return attempts.length >= this._max();
  }

  remaining(ip, action) {
    const windowStart = this._windowStart();
    const attempts = this.db.all().filter(
      a => a.ip === ip && a.action === action && a.timestamp > windowStart
    );
    return Math.max(0, this._max() - attempts.length);
  }

  clear(ip, action) {
    this.db.deleteWhere(a => a.ip === ip && a.action === action);
  }

  cleanOld() {
    const cutoff = this._windowStart() - 60 * 60 * 1000;
    this.db.deleteWhere(a => a.timestamp < cutoff);
  }
}

module.exports = new IpAttemptModel();
