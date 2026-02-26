/**
 * Migrate old role system (role ENUM) to new RBAC system (role_id FK)
 * Run: node migrate-roles.js
 */

const { pool } = require("../core/db");
const mysql = require("mysql2/promise");

async function migrate() {
  let conn;
  try {
    console.log("🔄 Iniciando migración de roles...\n");

    conn = await pool.getConnection();

    // 1. Check if role_id column exists, if not, the schema.sql was not run
    const tables = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME='users' AND TABLE_SCHEMA='crm_system'
    `);

    const hasRoleId = tables[0].some((col) => col.COLUMN_NAME === "role_id");
    if (!hasRoleId) {
      console.log("❌ Columna role_id no existe.");
      console.log(
        "   Por favor, ejecuta primero: mysql -u root -p < database/schema.sql\n",
      );
      return;
    }

    // 2. Migrate existing users based on role column
    console.log("📋 Migrando usuarios existentes...");
    const users = await conn.query(`
      SELECT id, email, role FROM users WHERE role_id IS NULL
    `);

    for (const [user] of users[0]) {
      let roleId = 4; // employee by default

      if (user.role === "admin" || user.role === "admin_rrhh") {
        roleId = 2; // admin
      } else if (user.role === "super_admin") {
        roleId = 1; // super_admin
      }

      await conn.execute(`UPDATE users SET role_id = ? WHERE id = ?`, [
        roleId,
        user.id,
      ]);

      console.log(`  ✅ ${user.email} → role_id ${roleId}`);
    }

    if (users[0].length === 0) {
      console.log("  ℹ️  No hay usuarios para migrar.");
    }

    // 3. Ensure admin@crm.com is super_admin
    console.log("\n🔐 Configurando admin@crm.com como super_admin...");
    const [adminUser] = await conn.query(`
      SELECT id FROM users WHERE email='admin@crm.com' LIMIT 1
    `);

    if (adminUser.length > 0) {
      await conn.execute(`UPDATE users SET role_id = 1 WHERE id = ?`, [
        adminUser[0].id,
      ]);
      console.log(
        "  ✅ admin@crm.com actualizado con role_id = 1 (super_admin)",
      );
    } else {
      console.log("  ⚠️  Usuario admin@crm.com no encontrado.");
      console.log("  Creando nuevo usuario admin...");

      const { hash } = require("bcrypt");
      const bcrypt = require("bcrypt");
      const { v4: uuidv4 } = require("uuid");

      const hashedPass = await bcrypt.hash("Admin1234!", 12);
      const newId = uuidv4();

      await conn.execute(
        `INSERT INTO users (id, name, email, password, role_id, is_active, created_at)
         VALUES (?, 'Administrador', 'admin@crm.com', ?, 1, 1, NOW())`,
        [newId, hashedPass],
      );
      console.log("  ✅ Usuario admin@crm.com creado con rol super_admin");
    }

    // 4. Verify all users have role_id
    console.log("\n✔️  Verificando integridad...");
    const [nullRoles] = await conn.query(`
      SELECT COUNT(*) as count FROM users WHERE role_id IS NULL
    `);

    if (nullRoles[0].count > 0) {
      console.log(
        `  ⚠️  Hay ${nullRoles[0].count} usuarios sin role_id asignado.`,
      );
      console.log("  Asignando role_id=4 (employee) a usuarios sin rol...");

      await conn.execute(`
        UPDATE users SET role_id = 4 WHERE role_id IS NULL
      `);
      console.log("  ✅ Completado");
    } else {
      console.log("  ✅ Todos los usuarios tienen role_id válido");
    }

    // 5. Summary
    const [summary] = await conn.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN u.role_id=1 THEN 1 ELSE 0 END) as super_admins,
        SUM(CASE WHEN u.role_id=2 THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN u.role_id=3 THEN 1 ELSE 0 END) as admin_rrhh,
        SUM(CASE WHEN u.role_id=4 THEN 1 ELSE 0 END) as employees
      FROM users u
    `);

    console.log("\n📊 Resumen final:");
    console.log(`  Total usuarios: ${summary[0].total}`);
    console.log(`  Super Admins: ${summary[0].super_admins}`);
    console.log(`  Admins: ${summary[0].admins}`);
    console.log(`  Admin RRHH: ${summary[0].admin_rrhh}`);
    console.log(`  Employees: ${summary[0].employees}`);

    // List all roles and permissions
    console.log("\n🔐 Roles configurados:");
    const [roles] = await conn.query(`
      SELECT r.id, r.nombre, COUNT(rp.permiso_id) as permisos
      FROM roles r
      LEFT JOIN roles_permisos rp ON rp.role_id = r.id
      GROUP BY r.id, r.nombre
      ORDER BY r.id
    `);

    for (const role of roles) {
      console.log(`  ${role.nombre}: ${role.permisos} permisos`);
    }

    console.log("\n✅ ¡Migración completada exitosamente!");
    console.log("\n💡 Puedes iniciar sesión con:");
    console.log("   Email: admin@crm.com");
    console.log("   Password: Admin1234!\n");
  } catch (err) {
    console.error("❌ Error en migración:", err.message);
    console.error(err);
  } finally {
    if (conn) await conn.release();
    process.exit(0);
  }
}

// Run
migrate();
