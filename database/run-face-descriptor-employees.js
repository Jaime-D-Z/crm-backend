const { pool } = require('../core/db');

async function runMigration() {
    try {
        console.log('🔄 Agregando columna face_descriptor a employees...');
        
        await pool.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name='employees' AND column_name='face_descriptor') THEN
                    ALTER TABLE employees 
                    ADD COLUMN face_descriptor TEXT NULL;
                    
                    RAISE NOTICE 'Column face_descriptor added to employees table';
                ELSE
                    RAISE NOTICE 'Column face_descriptor already exists in employees table';
                END IF;
            END $$;
        `);
        
        console.log('✅ Migración completada exitosamente');
        console.log('📋 Columna agregada: face_descriptor (TEXT)');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error ejecutando migración:', error);
        process.exit(1);
    }
}

runMigration();
