const { pool } = require('../core/db');

async function runMigration() {
    try {
        console.log('🔄 Agregando columna metodo_registro...');
        
        await pool.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name='asistencia_registros' AND column_name='metodo_registro') THEN
                    ALTER TABLE asistencia_registros 
                    ADD COLUMN metodo_registro VARCHAR(20) DEFAULT 'manual';
                    
                    RAISE NOTICE 'Column metodo_registro added successfully';
                ELSE
                    RAISE NOTICE 'Column metodo_registro already exists';
                END IF;
            END $$;
        `);
        
        console.log('✅ Migración completada exitosamente');
        console.log('📋 Columna agregada: metodo_registro (manual, facial, biometrico)');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error ejecutando migración:', error);
        process.exit(1);
    }
}

runMigration();
