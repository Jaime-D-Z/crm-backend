#!/usr/bin/env node

/**
 * Generate Secure Secrets for Production
 * 
 * Usage: node scripts/generate-secrets.js
 */

const crypto = require('crypto');

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  🔐 SECURE SECRETS GENERATOR                              ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log('Copy these values to your .env file:\n');
console.log('─────────────────────────────────────────────────────────────\n');

const jwtSecret = crypto.randomBytes(64).toString('hex');
const jwtRefreshSecret = crypto.randomBytes(64).toString('hex');
const sessionSecret = crypto.randomBytes(64).toString('hex');

console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`JWT_REFRESH_SECRET=${jwtRefreshSecret}`);
console.log(`SESSION_SECRET=${sessionSecret}`);

console.log('\n─────────────────────────────────────────────────────────────\n');
console.log('⚠️  IMPORTANT:');
console.log('   - Never commit these secrets to git');
console.log('   - Use different secrets for each environment');
console.log('   - Store them securely in your hosting platform');
console.log('   - Rotate them periodically for better security\n');
