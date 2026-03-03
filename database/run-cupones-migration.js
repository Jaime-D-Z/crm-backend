#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { query } = require("../core/db");

async function runMigration() {
  try {
    console.log("🚀 Iniciando migración de cupones y suscriptores...\n");

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, "add-cupones-suscriptores.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Ejecutar la migración
    console.log("📝 Ejecutando SQL...");
    await query(sql);

    console.log("✅ Migración completada exitosamente!\n");
    console.log("Tablas creadas:");
    console.log("  - suscriptores");
    console.log("  - cupones");
    console.log("  - cupones_uso");

    // Verificar que las tablas existen
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('suscriptores', 'cupones', 'cupones_uso')
      ORDER BY table_name
    `);

    console.log("\n✅ Verificación:");
    tables.forEach(t => {
      console.log(`  ✓ ${t.table_name}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error en la migración:", error.message);
    console.error("\nDetalles:", error);
    process.exit(1);
  }
}

runMigration();
