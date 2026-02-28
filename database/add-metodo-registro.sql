-- Add metodo_registro column to asistencia_registros table

DO $$ 
BEGIN
    -- Add metodo_registro column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='asistencia_registros' AND column_name='metodo_registro') THEN
        ALTER TABLE asistencia_registros 
        ADD COLUMN metodo_registro VARCHAR(20) DEFAULT 'manual';
        
        COMMENT ON COLUMN asistencia_registros.metodo_registro IS 'Método de registro: manual, facial, biometrico';
        
        PRINT 'Column metodo_registro added successfully';
    ELSE
        PRINT 'Column metodo_registro already exists';
    END IF;
END $$;
