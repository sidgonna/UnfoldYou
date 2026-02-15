-- ============================================================
-- Phase 4: Polish & Safety
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. NOTIFICATIONS SYSTEM

CREATE TABLE notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Triggered by this user
    type TEXT NOT NULL CHECK (type IN ('connection_request', 'connection_accepted', 'new_message', 'pov_like', 'reveal_milestone')),
    resource_id UUID, -- ID of the related object (connection_id, card_id, etc.)
    metadata JSONB DEFAULT '{}', -- Extra data like "message snippet" or "card title"
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id) WHERE is_read = FALSE;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = recipient_id);

CREATE POLICY "Users can update their own notifications (mark as read)"
    ON notifications FOR UPDATE
    USING (auth.uid() = recipient_id);

CREATE POLICY "Users can insert notifications for others"
    ON notifications FOR INSERT
    WITH CHECK (auth.uid() = actor_id); 
    -- Constraint: You can only create notifications where YOU are the actor.

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
