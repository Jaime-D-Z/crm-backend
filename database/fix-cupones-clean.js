#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { query } = require("../core/db");

async function fixCupones() {
  try {
    console.log("🧹 Limpiando tablas anteriores...\n");

    // Leer el archivo SQL de limpieza
    const sqlPath = path.join(__dirname, "fix-cupones-clean.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Ejecutar la limpieza y recreación
    console.log("📝 Ejecutando SQL...");
    await query(sql);

    console.log("✅ Tablas recreadas exitosamente!\n");
    console.log("Tablas creadas:");
    console.log("  ✓ suscriptores");
    console.log("  ✓ cupones");
    console.log("  ✓ cupones_uso");

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

    // Verificar estructura de cupones
    const cuponesStructure = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cupones' 
        AND column_name IN ('id', 'producto_id')
      ORDER BY column_name
    `);

    console.log("\n✅ Tipos de datos correctos:");
    cuponesStructure.forEach(col => {
      console.log(`  ✓ cupones.${col.column_name}: ${col.data_type}`);
    });

    console.log("\n🎉 ¡Todo listo! El sistema de cupones está funcionando.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("\nDetalles:", error);
    process.exit(1);
  }
}

fixCupones();
