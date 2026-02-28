-- Add additional fields to users table for profile management
-- Run this migration to add phone, department, position, photo_url, face_descriptor, and updated_at

-- Add columns if they don't exist
DO $$ 
BEGIN
    -- Add phone column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='phone') THEN
        ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL;
    END IF;

    -- Add department column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='department') THEN
        ALTER TABLE users ADD COLUMN department VARCHAR(100) NULL;
    END IF;

    -- Add position column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='position') THEN
        ALTER TABLE users ADD COLUMN position VARCHAR(100) NULL;
    END IF;

    -- Add photo_url column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='photo_url') THEN
        ALTER TABLE users ADD COLUMN photo_url VARCHAR(500) NULL;
    END IF;

    -- Add face_descriptor column for facial recognition
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='face_descriptor') THEN
        ALTER TABLE users ADD COLUMN face_descriptor TEXT NULL;
    END IF;

    -- Add updated_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='updated_at') THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_users_updated_at_trigger ON users;
CREATE TRIGGER update_users_updated_at_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- Create index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

COMMENT ON COLUMN users.phone IS 'User phone number';
COMMENT ON COLUMN users.department IS 'User department';
COMMENT ON COLUMN users.position IS 'User job position/title';
COMMENT ON COLUMN users.photo_url IS 'URL to user profile photo';
COMMENT ON COLUMN users.face_descriptor IS 'Face recognition descriptor (JSON array)';
COMMENT ON COLUMN users.updated_at IS 'Last update timestamp';
