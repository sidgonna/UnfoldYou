-- ==========================================
-- Phase 3: Connections & Chat — Migration
-- Run in Supabase SQL Editor before deploying Phase 3
-- ==========================================

-- 1. DELETE policy on connections (cancel pending requests)
CREATE POLICY "Requesters can cancel pending connections"
    ON connections FOR DELETE
    USING (auth.uid() = requester_id AND status = 'pending');

-- 2. UPDATE policy on messages (mark as read)
CREATE POLICY "Participants can mark messages as read"
    ON messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM connections
            WHERE connections.id = messages.connection_id
            AND (connections.requester_id = auth.uid() OR connections.recipient_id = auth.uid())
        )
    )
    WITH CHECK (
        sender_id != auth.uid()
    );

-- 3. updated_at trigger on connections
CREATE TRIGGER connections_updated_at
    BEFORE UPDATE ON connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_messages_connection_created
    ON messages(connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_connections_requester_status
    ON connections(requester_id, status);

CREATE INDEX IF NOT EXISTS idx_connections_recipient_status
    ON connections(recipient_id, status);

CREATE INDEX IF NOT EXISTS idx_connections_code
    ON connections(verification_code)
    WHERE verification_code IS NOT NULL AND status = 'pending';

-- 5. Helper function: batch mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(p_connection_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE affected INTEGER;
BEGIN
    UPDATE messages
    SET is_read = TRUE, read_at = NOW()
    WHERE connection_id = p_connection_id
      AND sender_id != p_user_id
      AND is_read = FALSE;
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
