/**
 * Fix collation mismatch — convert all new tables to utf8mb4_general_ci
 * to match the existing users/employees tables.
 * Run: node database/fix-collation.js
 */
require('dotenv').config();
const { query, verifyConnection } = require('../core/db');

const TABLES = [
    'evaluaciones_desempeno',
    'objetivos',
    'audit_duplicados',
    'permisos_ausencias',
    'transacciones_financieras',
    'notificaciones',
    'eventos_calendario',
    'asistencia_registros',
    'proyectos',
    'tareas_proyecto',
    'ventas',
    'roles',
    'permisos',
    'roles_permisos',
    'login_intentos',
];

async function run() {
    await verifyConnection();
    console.log('\n🔧 Fixing collation mismatch...\n');
    for (const t of TABLES) {
        try {
            const sql = `ALTER TABLE \`${t}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`;
            await query(sql);
            console.log(`  ✔ ${t}`);
        } catch (e) {
            console.log(`  ✘ ${t} — ${e.message.slice(0, 80)}`);
        }
    }
    console.log('\n✅ Collation fix complete!\n');
    process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
