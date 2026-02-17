-- Enable Realtime for pov_cards table
-- This allows the Feed to receive live updates when likes_count changes
ALTER PUBLICATION supabase_realtime ADD TABLE pov_cards;
