-- ============================================================
-- UnfoldYou — Supabase Schema Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ==================== PROFILES ====================

-- Real profile (private until "Unfold")
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dob DATE NOT NULL,
    -- age is computed at query time: DATE_PART('year', AGE(dob))
    height_cm INTEGER,
    gender TEXT NOT NULL,
    location_city TEXT,
    location_country TEXT,
    profile_picture_url TEXT,
    voice_note_url TEXT,
    habits JSONB DEFAULT '{}',
    intent TEXT CHECK (intent IN ('playful_spark', 'find_my_crowd', 'explore_love', 'something_real')),
    onboarding_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);


-- ==================== SHADOW PROFILES ====================

CREATE TABLE shadow_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shadow_name TEXT UNIQUE NOT NULL,
    avatar_id TEXT NOT NULL DEFAULT 'avatar_01',
    interests TEXT[] DEFAULT '{}',
    pronouns TEXT,
    social_energy TEXT CHECK (social_energy IN ('introvert', 'extrovert', 'ambivert')),
    bio TEXT CHECK (CHAR_LENGTH(bio) <= 150),
    sound_of_week_url TEXT,
    sound_of_week_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shadow_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view shadow profiles"
    ON shadow_profiles FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own shadow profile"
    ON shadow_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own shadow profile"
    ON shadow_profiles FOR UPDATE
    USING (auth.uid() = id);

-- ==================== LOVE SOUL ====================

CREATE TABLE love_soul (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    q1_overwhelmed TEXT NOT NULL,
    q2_seen_appreciated TEXT NOT NULL,
    q3_disagreement TEXT NOT NULL,
    q_final_love TEXT NOT NULL,
    attachment_style TEXT,
    love_language TEXT,
    conflict_style TEXT,
    compatibility_vector FLOAT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE love_soul ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own love soul"
    ON love_soul FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own love soul"
    ON love_soul FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own love soul"
    ON love_soul FOR UPDATE
    USING (auth.uid() = id);



-- ==================== POV CARDS ====================

CREATE TABLE pov_cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (CHAR_LENGTH(content) <= 500),
    template TEXT NOT NULL DEFAULT 'midnight',
    is_saved BOOLEAN DEFAULT FALSE,
    saved_at TIMESTAMPTZ,
    likes_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pov_cards ENABLE ROW LEVEL SECURITY;

-- Active = saved OR not expired
CREATE POLICY "Active cards are publicly readable"
    ON pov_cards FOR SELECT
    USING (
        auth.uid() IS NOT NULL
        AND (is_saved = TRUE OR expires_at > NOW())
    );

CREATE POLICY "Users can create their own cards"
    ON pov_cards FOR INSERT
    WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their own cards"
    ON pov_cards FOR UPDATE
    USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their own cards"
    ON pov_cards FOR DELETE
    USING (auth.uid() = creator_id);

-- ==================== POV LIKES ====================

CREATE TABLE pov_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    card_id UUID NOT NULL REFERENCES pov_cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(card_id, user_id)
);

ALTER TABLE pov_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view likes"
    ON pov_likes FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can like cards"
    ON pov_likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike cards"
    ON pov_likes FOR DELETE
    USING (auth.uid() = user_id);

-- ==================== CONNECTIONS ====================

CREATE TABLE connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_type TEXT NOT NULL CHECK (connection_type IN ('stranger', 'known')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    request_message TEXT,
    verification_code TEXT,
    code_expires_at TIMESTAMPTZ,
    code_attempts INTEGER DEFAULT 0,
    reveal_stage TEXT DEFAULT 'shadow' CHECK (reveal_stage IN ('shadow', 'whisper', 'glimpse', 'soul', 'unfold')),
    message_count INTEGER DEFAULT 0,
    unfold_requester BOOLEAN DEFAULT FALSE,
    unfold_recipient BOOLEAN DEFAULT FALSE,
    consent_status JSONB DEFAULT '{}',
    last_consent_request TIMESTAMPTZ,
    connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(requester_id, recipient_id)
);

ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections"
    ON connections FOR SELECT
    USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can create connections"
    ON connections FOR INSERT
    WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update own connections"
    ON connections FOR UPDATE
    USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- ==================== MESSAGES ====================

CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'emoji', 'voice', 'image', 'system')),
    media_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own messages"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM connections
            WHERE connections.id = messages.connection_id
            AND (connections.requester_id = auth.uid() OR connections.recipient_id = auth.uid())
        )
    );

CREATE POLICY "Users can send messages in their connections"
    ON messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM connections
            WHERE connections.id = connection_id
            AND connections.status = 'accepted'
            AND (connections.requester_id = auth.uid() OR connections.recipient_id = auth.uid())
        )
    );

-- ==================== REPORTS ====================

CREATE TABLE reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reported_card_id UUID REFERENCES pov_cards(id),
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports"
    ON reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports"
    ON reports FOR SELECT
    USING (auth.uid() = reporter_id);

-- ==================== BLOCKED USERS ====================

CREATE TABLE blocked_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their blocks"
    ON blocked_users FOR ALL
    USING (auth.uid() = blocker_id);

-- ==================== CROSS-TABLE POLICIES ====================
-- These reference `connections` so must come after that table is created

CREATE POLICY "Users can view unfolded connections profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM connections
            WHERE status = 'accepted'
            AND reveal_stage = 'unfold'
            AND (
                (requester_id = auth.uid() AND recipient_id = profiles.id)
                OR (recipient_id = auth.uid() AND requester_id = profiles.id)
            )
        )
    );

CREATE POLICY "Known connections can view profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM connections
            WHERE status = 'accepted'
            AND connection_type = 'known'
            AND (
                (requester_id = auth.uid() AND recipient_id = profiles.id)
                OR (recipient_id = auth.uid() AND requester_id = profiles.id)
            )
        )
    );

CREATE POLICY "Users can view connected profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM connections
            WHERE (
                (connections.requester_id = auth.uid() AND connections.recipient_id = profiles.id)
                OR 
                (connections.recipient_id = auth.uid() AND connections.requester_id = profiles.id)
            )
            AND connections.status = 'accepted'
        )
    );

CREATE POLICY "Soul-stage connections can view love soul"
    ON love_soul FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM connections
            WHERE status = 'accepted'
            AND reveal_stage IN ('soul', 'unfold')
            AND (
                (requester_id = auth.uid() AND recipient_id = love_soul.id)
                OR (recipient_id = auth.uid() AND requester_id = love_soul.id)
            )
        )
    );

-- ==================== FUNCTIONS ====================

-- Progressive reveal trigger
CREATE OR REPLACE FUNCTION check_reveal_progression()
RETURNS TRIGGER AS $$
BEGIN
    -- Update message count
    UPDATE connections 
    SET message_count = message_count + 1, 
        updated_at = NOW() 
    WHERE id = NEW.connection_id;

    -- NOTE: Stage progression is now handled via manual "Unlock" request (submitStageConsent)
    -- This ensures mutual participation and consent before revealing.
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_message_insert
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION check_reveal_progression();

-- Like counter function
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE pov_cards SET likes_count = likes_count + 1 WHERE id = NEW.card_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE pov_cards SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.card_id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_like_change
    AFTER INSERT OR DELETE ON pov_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_likes_count();

-- Updated_at auto-update
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER shadow_profiles_updated_at BEFORE UPDATE ON shadow_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER love_soul_updated_at BEFORE UPDATE ON love_soul
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==================== STORAGE ====================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('voice_notes', 'voice_notes', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for Avatars
CREATE POLICY "Avatar Public Read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

CREATE POLICY "Avatar User Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = owner );

CREATE POLICY "Avatar User Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'avatars' AND auth.uid() = owner );

-- Policies for Voice Notes
CREATE POLICY "Voice Note Public Read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'voice_notes' );

CREATE POLICY "Voice Note User Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'voice_notes' AND auth.uid() = owner );

-- ==================== REALTIME ====================
-- Enable realtime on messages table for chat
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE connections;

-- ==================== NOTIFICATIONS ====================

CREATE TABLE notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('connection_request', 'connection_accepted', 'new_message', 'pov_like', 'reveal_milestone')),
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = recipient_id);

CREATE POLICY "Users can insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = recipient_id);

ALTER PUBLICATION supabase_realtime ADD TABLE pov_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

