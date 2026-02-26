const jwt = require('jsonwebtoken');
const config = require('../config');

const ACCESS_SECRET = config.jwt.accessSecret;
const REFRESH_SECRET = config.jwt.refreshSecret;
const ACCESS_EXP = config.jwt.accessExpiry;
const REFRESH_EXP = config.jwt.refreshExpiry;

function signToken(payload) {
    return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXP });
}

function verifyToken(token) {
    return jwt.verify(token, ACCESS_SECRET);
}

function signRefresh(payload) {
    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXP });
}

function verifyRefresh(token) {
    return jwt.verify(token, REFRESH_SECRET);
}

module.exports = { signToken, verifyToken, signRefresh, verifyRefresh };
