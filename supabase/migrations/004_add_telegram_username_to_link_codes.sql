-- Add telegram_username column to telegram_link_codes
-- This stores the Telegram username when the code is generated via /start
ALTER TABLE telegram_link_codes ADD COLUMN telegram_username TEXT;
