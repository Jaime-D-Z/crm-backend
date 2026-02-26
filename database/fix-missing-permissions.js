#!/usr/bin/env node
/**
 * Fix Missing Permissions
 * Run: node database/fix-missing-permissions.js
 *
 * This script adds all missing permissions that are required by the API endpoints
 */

require("dotenv").config();
const { query, verifyConnection } = require("../core/db");

const MODULOS_REQUERIDOS = [
  "Asistencia",
  "Proyectos",
  "Ventas",
  "Finanzas",
  "Notificaciones",
  "Calendario",
  "Analitica",
];

const ACCIONES_DEFECTO = ["ver", "crear", "editar", "eliminar"];

async function run() {
  try {
    console.log("\n🔧 Iniciando fix de permisos...\n");

    await verifyConnection();
    console.log("✔ Base de datos conectada\n");

    // Get role IDs
    const rolesQuery = await query(`
            SELECT id, nombre FROM roles 
            WHERE nombre IN ('super_admin', 'admin_rrhh')
        `);

    const roles = {};
    for (const r of rolesQuery) {
      roles[r.nombre] = r.id;
    }

    if (!roles.super_admin) {
      console.error("❌ No se encontró el rol super_admin");
      process.exit(1);
    }

    console.log(`Roles encontrados:`);
    for (const [nombre, id] of Object.entries(roles)) {
      console.log(`  • ${nombre}: ${id}`);
    }
    console.log();

    // Add missing permissions
    console.log("Agregando permisos faltantes:");
    let agregados = 0;

    for (const modulo of MODULOS_REQUERIDOS) {
      for (const accion of ACCIONES_DEFECTO) {
        const result = await query(
          `INSERT IGNORE INTO permisos (modulo, accion, label) VALUES (?, ?, ?)`,
          [modulo, accion, `${modulo} > ${accion}`],
        );

        if (result.affectedRows > 0) {
          console.log(`  ✔ Creado: ${modulo} > ${accion}`);
          agregados++;
        }
      }
    }

    console.log(`\n${agregados} permisos nuevos agregados\n`);

    // Get permission IDs
    console.log("Configurando asignaciones de rol > permiso:");
    let asignaciones = 0;

    for (const modulo of MODULOS_REQUERIDOS) {
      for (const accion of ACCIONES_DEFECTO) {
        const permisoRows = await query(
          `SELECT id FROM permisos WHERE modulo = ? AND accion = ?`,
          [modulo, accion],
        );

        if (!permisoRows.length) continue;

        const permisoId = permisoRows[0].id;

        // Assign to all important roles
        for (const [nombreRol, roleId] of Object.entries(roles)) {
          // Super admin gets everything
          if (nombreRol === "super_admin") {
            const assignResult = await query(
              `INSERT IGNORE INTO roles_permisos (role_id, permiso_id) VALUES (?, ?)`,
              [roleId, permisoId],
            );
            if (assignResult.affectedRows > 0) {
              asignaciones++;
            }
          }
          // Admin RRHH gets most things except delete for some modules
          else if (nombreRol === "admin_rrhh" && accion !== "eliminar") {
            const assignResult = await query(
              `INSERT IGNORE INTO roles_permisos (role_id, permiso_id) VALUES (?, ?)`,
              [roleId, permisoId],
            );
            if (assignResult.affectedRows > 0) {
              asignaciones++;
            }
          }
        }
      }
    }

    console.log(`  ✔ ${asignaciones} nuevas asignaciones de rol > permiso\n`);

    // Summary
    console.log("📊 Resumen de Permisos:");
    const summary = await query(`
            SELECT 
                modulo,
                COUNT(*) as total_acciones,
                COUNT(DISTINCT IF(modulo IN ('Asistencia', 'Proyectos', 'Ventas', 'Finanzas', 'Notificaciones', 'Calendario', 'Analitica'), 1, NULL)) as activo
            FROM permisos 
            GROUP BY modulo 
            HAVING total_acciones > 0
            ORDER BY modulo
        `);

    for (const row of summary) {
      const status = row.activo ? "✔" : "❌";
      console.log(`  ${status} ${row.modulo}: ${row.total_acciones} acciones`);
    }

    console.log("\n✅ ¡Fix completado exitosamente!\n");
    console.log("Ahora puedes:");
    console.log("  1. Recarga la aplicación en el navegador");
    console.log(
      "  2. Intenta acceder a los demás módulos (Proyectos, Ventas, etc)",
    );
    console.log(
      "  3. Si persisten errores 403, verifica los roles del usuario\n",
    );

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

run();
