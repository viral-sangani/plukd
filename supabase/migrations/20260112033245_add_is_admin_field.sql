-- Add is_admin field to users table
ALTER TABLE users
ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comment to document the field
COMMENT ON COLUMN users.is_admin IS 'Flag indicating if user has admin privileges';

-- Create index for faster admin checks
CREATE INDEX idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;
