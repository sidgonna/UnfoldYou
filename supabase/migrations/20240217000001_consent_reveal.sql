-- Consent-Based Reveal Migration
-- 1. Add columns to track consent status and cooldowns
-- 2. Update trigger to STOP automatic stage progression

-- enable pgcrypto for generatng IDs if not already? (usually on by default in supa)

ALTER TABLE connections 
ADD COLUMN IF NOT EXISTS consent_status JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_consent_request TIMESTAMPTZ;

-- consent_status structure:
-- {
--   "target_stage": "whisper",
--   "requests": { "user_id_1": "accepted", "user_id_2": "pending" },
--   "cooldown_until": "2024-02-17T12:00:00Z" (optional, managed via last_consent_request + interval)
-- }

-- Update the progression trigger to ONLY count messages
CREATE OR REPLACE FUNCTION check_reveal_progression()
RETURNS TRIGGER AS $$
DECLARE
    conn RECORD;
BEGIN
    SELECT * INTO conn FROM connections WHERE id = NEW.connection_id;

    -- Known connections: Standard update
    IF conn.connection_type = 'known' THEN
        UPDATE connections 
        SET message_count = message_count + 1, 
            updated_at = NOW()
        WHERE id = conn.id;
        RETURN NEW;
    END IF;

    -- Stranger connections: Just update message count and timestamp
    -- WE DO NOT AUTO-UPDATE THE STAGE ANYMORE
    UPDATE connections 
    SET message_count = message_count + 1, 
        updated_at = NOW()
    WHERE id = conn.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
