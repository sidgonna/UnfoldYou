-- ============================================================
-- UnfoldYou — Search Indexes
-- Run in Supabase SQL Editor AFTER running schema.sql
-- ============================================================

-- 1. Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Trigram index on shadow_name for fuzzy/partial matching
-- Supports queries like: WHERE shadow_name ILIKE '%query%'
CREATE INDEX IF NOT EXISTS idx_shadow_name_trgm
    ON shadow_profiles
    USING gin (shadow_name gin_trgm_ops);

-- 3. GIN index on interests array for containment queries
-- Supports queries like: WHERE interests @> ARRAY['Pop', 'Gaming']
CREATE INDEX IF NOT EXISTS idx_interests_gin
    ON shadow_profiles
    USING gin (interests);
