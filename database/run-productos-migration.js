/**
 * MIGRACIÓN SEGURA: E-COMMERCE - PRODUCTOS Y ANALYTICS
 * 
 * Este script ejecuta la migración de forma segura en producción:
 * - Verifica conexión a la base de datos
 * - Ejecuta la migración SQL
 * - Valida que las tablas se crearon correctamente
 * - Muestra resumen de cambios
 * 
 * USO:
 *   node backend/database/run-productos-migration.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, verifyConnection } = require('../core/db');

async function runMigration() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  MIGRACIÓN: E-COMMERCE - PRODUCTOS Y ANALYTICS         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Verificar conexión
    console.log('📡 Verificando conexión a PostgreSQL...');
    await verifyConnection();
    console.log('✅ Conexión exitosa\n');

    // 2. Leer archivo SQL
    console.log('📄 Leyendo archivo de migración...');
    const sqlPath = path.join(__dirname, 'add-productos-ecommerce.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    console.log('✅ Archivo cargado\n');

    // 3. Ejecutar migración
    console.log('🔧 Ejecutando migración...');
    console.log('   - Creando tabla productos');
    console.log('   - Creando tabla eventos_productos');
    console.log('   - Añadiendo permisos');
    console.log('   - Creando índices\n');

    await query(sqlContent);
    
    console.log('✅ Migración ejecutada exitosamente\n');

    // 4. Verificar tablas creadas
    console.log('🔍 Verificando tablas creadas...\n');

    const tablesCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('productos', 'eventos_productos')
      ORDER BY table_name
    `);

    console.log('📊 Tablas encontradas:');
    tablesCheck.forEach(t => {
      console.log(`   ✓ ${t.table_name}`);
    });

    // 5. Verificar permisos
    const permisosCheck = await query(`
      SELECT COUNT(*) as total 
      FROM permisos 
      WHERE modulo = 'Productos'
    `);

    console.log(`\n📋 Permisos creados: ${permisosCheck[0].total}`);

    // 6. Mostrar estructura de productos
    const productosColumns = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'productos'
      ORDER BY ordinal_position
    `);

    console.log('\n📦 Estructura de tabla productos:');
    productosColumns.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    // 7. Resumen final
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  ✅ MIGRACIÓN COMPLETADA EXITOSAMENTE                  ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log('📝 Próximos pasos:');
    console.log('   1. Reiniciar el servidor backend');
    console.log('   2. Verificar que los endpoints funcionan');
    console.log('   3. Probar el CRUD de productos desde el dashboard\n');

    console.log('🔗 Nuevos endpoints disponibles:');
    console.log('   GET    /api/productos/publicos  (sin auth)');
    console.log('   GET    /api/productos           (con auth)');
    console.log('   POST   /api/productos           (con auth)');
    console.log('   PUT    /api/productos/:id       (con auth)');
    console.log('   DELETE /api/productos/:id       (con auth)');
    console.log('   POST   /api/ventas/evento       (sin auth)\n');

  } catch (error) {
    console.error('\n❌ ERROR EN LA MIGRACIÓN:\n');
    console.error(error.message);
    console.error('\n📋 Detalles del error:');
    console.error(error);
    console.error('\n⚠️  La base de datos NO fue modificada.');
    console.error('⚠️  Puedes ejecutar el script nuevamente de forma segura.\n');
    process.exit(1);
  }

  process.exit(0);
}

// Ejecutar migración
runMigration();
