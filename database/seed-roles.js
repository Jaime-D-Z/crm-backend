/**
 * Seed: Roles, Permisos y Admin Inicial
 * Run: node database/seed-roles.js
 */
require('dotenv').config();
const { query, verifyConnection } = require('../core/db');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const ROLES = [
    { nombre: 'super_admin', descripcion: 'Acceso completo a todo el sistema' },
    { nombre: 'admin_rrhh', descripcion: 'Gestión de RRHH, empleados y auditoría' },
    { nombre: 'instructor', descripcion: 'Ve su perfil, objetivos e historial' },
    { nombre: 'developer', descripcion: 'Acceso técnico: analítica, logs' },
    { nombre: 'assistant', descripcion: 'Consulta de empleados y reportes básicos' },
];

const MODULOS = ['RRHH', 'Desempeno', 'Objetivos', 'Auditoria', 'Analitica', 'Configuracion'];
const ACCIONES = ['ver', 'crear', 'editar', 'eliminar', 'exportar'];

// Permisos por rol: true = tiene el permiso
const PERMISOS_ROL = {
    super_admin: { RRHH: ['ver', 'crear', 'editar', 'eliminar', 'exportar'], Desempeno: ['ver', 'crear', 'editar', 'eliminar', 'exportar'], Objetivos: ['ver', 'crear', 'editar', 'eliminar', 'exportar'], Auditoria: ['ver', 'exportar'], Analitica: ['ver', 'exportar'], Configuracion: ['ver', 'crear', 'editar', 'eliminar'] },
    admin_rrhh: { RRHH: ['ver', 'crear', 'editar', 'exportar'], Desempeno: ['ver', 'crear', 'editar'], Objetivos: ['ver', 'crear', 'editar'], Auditoria: ['ver', 'exportar'], Analitica: ['ver'] },
    instructor: { RRHH: ['ver'], Desempeno: ['ver'], Objetivos: ['ver'] },
    developer: { RRHH: ['ver'], Analitica: ['ver', 'exportar'], Auditoria: ['ver'] },
    assistant: { RRHH: ['ver', 'exportar'], Objetivos: ['ver'] },
};

async function run() {
    await verifyConnection();
    console.log('\n🌱 Seeding roles & permissions...\n');

    // Insert roles
    const roleMap = {};
    for (const r of ROLES) {
        await query(`INSERT IGNORE INTO roles (nombre, descripcion) VALUES (?,?)`, [r.nombre, r.descripcion]);
        const rows = await query(`SELECT id FROM roles WHERE nombre=? LIMIT 1`, [r.nombre]);
        roleMap[r.nombre] = rows[0].id;
        console.log(`  ✔ Rol: ${r.nombre} (id=${rows[0].id})`);
    }

    // Insert all permisos
    const permisoMap = {};
    for (const m of MODULOS) {
        for (const a of ACCIONES) {
            await query(`INSERT IGNORE INTO permisos (modulo, accion, label) VALUES (?,?,?)`, [m, a, `${m} > ${a}`]);
            const rows = await query(`SELECT id FROM permisos WHERE modulo=? AND accion=? LIMIT 1`, [m, a]);
            permisoMap[`${m}:${a}`] = rows[0].id;
        }
    }
    console.log(`  ✔ Permisos creados: ${Object.keys(permisoMap).length}`);

    // Assign permissions to roles
    for (const [rolNombre, mods] of Object.entries(PERMISOS_ROL)) {
        const roleId = roleMap[rolNombre];
        for (const [mod, acciones] of Object.entries(mods)) {
            for (const acc of acciones) {
                const pid = permisoMap[`${mod}:${acc}`];
                if (pid) await query(`INSERT IGNORE INTO roles_permisos (role_id, permiso_id) VALUES (?,?)`, [roleId, pid]);
            }
        }
        console.log(`  ✔ Permisos asignados a: ${rolNombre}`);
    }

    // Set existing admin as super_admin
    const superAdminRoleId = roleMap['super_admin'];
    await query(`UPDATE users SET role_id=? WHERE email='admin@crm.com'`, [superAdminRoleId]);
    console.log('\n  ✅ admin@crm.com → super_admin');

    console.log('\n🎉 Seed complete!\n');
    process.exit(0);
}

run().catch(err => { console.error('Seed error:', err.message); process.exit(1); });
