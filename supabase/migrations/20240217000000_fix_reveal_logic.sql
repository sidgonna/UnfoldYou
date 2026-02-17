-- Fix for Chat Reveal Logic & Thresholds
-- 1. Enforce mutual participation (both users must send messages)
-- 2. Sync thresholds with UI (20, 50, 100 messages)

CREATE OR REPLACE FUNCTION check_reveal_progression()
RETURNS TRIGGER AS $$
DECLARE
    conn RECORD;
    days_since INTEGER;
    is_mutual BOOLEAN;
BEGIN
    -- Get connection details
    SELECT * INTO conn FROM connections WHERE id = NEW.connection_id;

    -- Known connections don't use progressive reveal (or use different logic)
    IF conn.connection_type = 'known' THEN
        -- Still update message count
        UPDATE connections 
        SET message_count = message_count + 1, 
            updated_at = NOW()
        WHERE id = conn.id;
        RETURN NEW;
    END IF;

    -- Calculate days since connection was accepted
    days_since := DATE_PART('day', NOW() - conn.connected_at)::INTEGER;

    -- Update message count
    UPDATE connections 
    SET message_count = message_count + 1, 
        updated_at = NOW()
    WHERE id = conn.id;

    -- Check for mutual participation
    -- Both users must have sent at least one message
    SELECT EXISTS (
        SELECT 1 
        FROM messages m1
        WHERE m1.connection_id = NEW.connection_id 
        AND m1.sender_id != NEW.sender_id
        LIMIT 1
    ) INTO is_mutual;

    -- If not mutual yet, don't progress stage
    IF NOT is_mutual THEN
        RETURN NEW;
    END IF;

    -- Check thresholds (Synced with UI: 20, 50, 100)
    -- Using the NEW message count (conn.message_count + 1)
    
    -- Shadow -> Whisper (20 msgs)
    IF conn.reveal_stage = 'shadow' AND (conn.message_count + 1) >= 20 THEN
        UPDATE connections 
        SET reveal_stage = 'whisper', updated_at = NOW() 
        WHERE id = conn.id;
        
    -- Whisper -> Glimpse (50 msgs + 3 days)
    ELSIF conn.reveal_stage = 'whisper' AND (conn.message_count + 1) >= 50 AND days_since >= 3 THEN
        UPDATE connections 
        SET reveal_stage = 'glimpse', updated_at = NOW() 
        WHERE id = conn.id;
        
    -- Glimpse -> Soul (100 msgs + 7 days)
    ELSIF conn.reveal_stage = 'glimpse' AND (conn.message_count + 1) >= 100 AND days_since >= 7 THEN
        UPDATE connections 
        SET reveal_stage = 'soul', updated_at = NOW() 
        WHERE id = conn.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
