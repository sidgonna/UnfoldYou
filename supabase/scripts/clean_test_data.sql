-- ============================================================
-- Utility: Clean Test Data
-- Run this to wipe user data after testing (Be careful!)
-- ============================================================

-- Replace with the specific email of your test user
-- DELETE FROM auth.users WHERE email = 'test_user@example.com';

-- OR, delete based on shadow name if easier
-- DELETE FROM auth.users WHERE id IN (SELECT id FROM shadow_profiles WHERE shadow_name = 'test_shadow_name');

-- Note: Because of ON DELETE CASCADE, this will automatically remove:
-- - Profiles (Real & Shadow)
-- - Love Soul answers
-- - POV Cards
-- - Messages (sent by them)
-- - Connections (involving them)
