-- Allow user_id to be null in telegram_link_codes
-- Bot creates codes before user links (user_id set during verification)
ALTER TABLE telegram_link_codes ALTER COLUMN user_id DROP NOT NULL;
