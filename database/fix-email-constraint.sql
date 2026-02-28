-- Remove old unique constraint on email
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_email_key;

-- Add partial unique index: only enforce uniqueness for active employees
CREATE UNIQUE INDEX employees_email_active_unique 
ON employees (LOWER(email)) 
WHERE status = 'active';

-- This allows:
-- ✅ Multiple inactive employees with same email
-- ✅ One active employee per email
-- ❌ Two active employees with same email
