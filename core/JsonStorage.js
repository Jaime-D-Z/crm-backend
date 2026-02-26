const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class JsonStorage {
  constructor(filePath) {
    this.filePath = filePath;
    this._ensureFile();
  }

  _ensureFile() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.filePath)) fs.writeFileSync(this.filePath, '[]');
  }

  _read() {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch {
      return [];
    }
  }

  _write(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  all() {
    return this._read();
  }

  find(field, value) {
    return this._read().find(item => item[field] === value) ?? null;
  }

  findAll(field, value) {
    return this._read().filter(item => item[field] === value);
  }

  insert(record) {
    const data = this._read();
    const newRecord = { id: uuidv4(), ...record };
    data.push(newRecord);
    this._write(data);
    return newRecord;
  }

  update(field, value, updates) {
    const data = this._read();
    const idx = data.findIndex(item => item[field] === value);
    if (idx === -1) return false;
    data[idx] = { ...data[idx], ...updates };
    this._write(data);
    return true;
  }

  delete(field, value) {
    const data = this._read();
    const filtered = data.filter(item => item[field] !== value);
    this._write(filtered);
    return true;
  }

  deleteWhere(predicate) {
    const data = this._read();
    this._write(data.filter(item => !predicate(item)));
    return true;
  }
}

module.exports = JsonStorage;
