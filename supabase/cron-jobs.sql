-- ============================================================
-- UnfoldYou — Cron Jobs (pg_cron)
-- Run in Supabase SQL Editor AFTER enabling pg_cron extension
-- ============================================================

-- IMPORTANT: You must first enable pg_cron in your Supabase project:
-- Go to Supabase Dashboard > Database > Extensions > search "pg_cron" > Enable

-- 1. Clean up expired, unsaved POV cards every hour
SELECT cron.schedule(
    'cleanup-expired-pov-cards',
    '0 * * * *',
    $$
    DELETE FROM pov_cards
    WHERE expires_at < NOW()
    AND is_saved = FALSE;
    $$
);

-- 2. Expire stale pending connection requests older than 7 days
SELECT cron.schedule(
    'expire-stale-requests',
    '0 * * * *',
    $$
    UPDATE connections
    SET status = 'expired'
    WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '7 days';
    $$
);

-- 3. Expire verification codes for known connections
SELECT cron.schedule(
    'expire-verification-codes',
    '30 * * * *',
    $$
    UPDATE connections
    SET status = 'expired'
    WHERE connection_type = 'known'
    AND status = 'pending'
    AND code_expires_at < NOW();
    $$
);
