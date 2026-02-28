-- Add face_descriptor column to employees table

DO $$ 
BEGIN
    -- Add face_descriptor column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='employees' AND column_name='face_descriptor') THEN
        ALTER TABLE employees 
        ADD COLUMN face_descriptor TEXT NULL;
        
        COMMENT ON COLUMN employees.face_descriptor IS 'Face recognition descriptor (JSON array of 128 numbers)';
        
        RAISE NOTICE 'Column face_descriptor added to employees table';
    ELSE
        RAISE NOTICE 'Column face_descriptor already exists in employees table';
    END IF;
END $$;
