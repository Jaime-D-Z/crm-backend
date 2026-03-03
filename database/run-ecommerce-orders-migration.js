#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { query } = require("../core/db");

async function runMigration() {
  console.log("🚀 Iniciando migración de tablas de e-commerce...\n");

  try {
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, "add-ecommerce-orders.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    console.log("📄 Ejecutando SQL...");
    await query(sql);

    console.log("✅ Tablas creadas exitosamente:");
    console.log("   - pedidos");
    console.log("   - pedidos_detalle");
    console.log("   - Índices y triggers configurados");
    console.log("   - Función generar_numero_orden() creada\n");

    // Verificar las tablas
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('pedidos', 'pedidos_detalle')
      ORDER BY table_name
    `);

    console.log("📊 Tablas verificadas:");
    tables.forEach(t => console.log(`   ✓ ${t.table_name}`));

    console.log("\n✨ Migración completada exitosamente!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en la migración:", error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
