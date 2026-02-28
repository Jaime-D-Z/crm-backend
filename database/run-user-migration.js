const { pool } = require('../core/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('🔄 Ejecutando migración de campos de usuario...');
        
        const sql = fs.readFileSync(
            path.join(__dirname, 'add-user-fields.sql'),
            'utf8'
        );

        await pool.query(sql);
        
        console.log('✅ Migración completada exitosamente');
        console.log('📋 Campos agregados a la tabla users:');
        console.log('   - phone (VARCHAR(30))');
        console.log('   - department (VARCHAR(100))');
        console.log('   - position (VARCHAR(100))');
        console.log('   - photo_url (VARCHAR(500))');
        console.log('   - face_descriptor (TEXT)');
        console.log('   - updated_at (TIMESTAMP)');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error ejecutando migración:', error);
        process.exit(1);
    }
}

runMigration();
