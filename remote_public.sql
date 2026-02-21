


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."check_reveal_progression"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."check_reveal_progression"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_likes"("card_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE pov_cards SET likes_count = GREATEST(0, likes_count - 1) WHERE id = card_id;
END;
$$;


ALTER FUNCTION "public"."decrement_likes"("card_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_expired_cards"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM pov_cards 
  WHERE expires_at < NOW() 
    AND is_saved = FALSE;
END;
$$;


ALTER FUNCTION "public"."delete_expired_cards"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_likes"("card_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE pov_cards SET likes_count = likes_count + 1 WHERE id = card_id;
END;
$$;


ALTER FUNCTION "public"."increment_likes"("card_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_messages_read"("p_connection_id" "uuid", "p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."mark_messages_read"("p_connection_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_likes_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE pov_cards SET likes_count = likes_count + 1 WHERE id = NEW.card_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE pov_cards SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.card_id;
        RETURN OLD;
    END IF;
END;
$$;


ALTER FUNCTION "public"."update_likes_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_observer_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE shadow_profiles
  SET observer_unlocked = TRUE
  WHERE id = NEW.id 
    AND posts_count >= 1 
    AND likes_given >= 3
    AND observer_unlocked = FALSE;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_observer_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."blocked_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."blocked_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "connection_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "request_message" "text",
    "verification_code" "text",
    "code_expires_at" timestamp with time zone,
    "code_attempts" integer DEFAULT 0,
    "reveal_stage" "text" DEFAULT 'shadow'::"text",
    "message_count" integer DEFAULT 0,
    "unfold_requester" boolean DEFAULT false,
    "unfold_recipient" boolean DEFAULT false,
    "connected_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "consent_status" "jsonb" DEFAULT '{}'::"jsonb",
    "last_consent_request" timestamp with time zone,
    CONSTRAINT "connections_connection_type_check" CHECK (("connection_type" = ANY (ARRAY['stranger'::"text", 'known'::"text"]))),
    CONSTRAINT "connections_reveal_stage_check" CHECK (("reveal_stage" = ANY (ARRAY['shadow'::"text", 'whisper'::"text", 'glimpse'::"text", 'soul'::"text", 'unfold'::"text"]))),
    CONSTRAINT "connections_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."love_soul" (
    "id" "uuid" NOT NULL,
    "q1_overwhelmed" "text" NOT NULL,
    "q2_seen_appreciated" "text" NOT NULL,
    "q3_disagreement" "text" NOT NULL,
    "q_final_love" "text" NOT NULL,
    "attachment_style" "text",
    "love_language" "text",
    "conflict_style" "text",
    "compatibility_vector" double precision[] DEFAULT '{}'::double precision[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."love_soul" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "connection_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "message_type" "text" DEFAULT 'text'::"text",
    "media_url" "text",
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['text'::"text", 'emoji'::"text", 'voice'::"text", 'image'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "type" "text" NOT NULL,
    "resource_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['connection_request'::"text", 'connection_accepted'::"text", 'new_message'::"text", 'pov_like'::"text", 'reveal_milestone'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pov_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "template" "text" DEFAULT 'midnight'::"text" NOT NULL,
    "is_saved" boolean DEFAULT false,
    "saved_at" timestamp with time zone,
    "likes_count" integer DEFAULT 0,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pov_cards_content_check" CHECK (("char_length"("content") <= 500))
);


ALTER TABLE "public"."pov_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pov_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "card_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pov_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "dob" "date" NOT NULL,
    "height_cm" integer,
    "gender" "text" NOT NULL,
    "location_city" "text",
    "location_country" "text",
    "profile_picture_url" "text",
    "voice_note_url" "text",
    "habits" "jsonb" DEFAULT '{}'::"jsonb",
    "intent" "text",
    "onboarding_complete" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profiles_intent_check" CHECK (("intent" = ANY (ARRAY['playful_spark'::"text", 'find_my_crowd'::"text", 'explore_love'::"text", 'something_real'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reported_user_id" "uuid",
    "reported_card_id" "uuid",
    "reason" "text" NOT NULL,
    "details" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewing'::"text", 'resolved'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shadow_profiles" (
    "id" "uuid" NOT NULL,
    "shadow_name" "text" NOT NULL,
    "avatar_id" "text" DEFAULT 'avatar_01'::"text" NOT NULL,
    "interests" "text"[] DEFAULT '{}'::"text"[],
    "pronouns" "text",
    "social_energy" "text",
    "bio" "text",
    "sound_of_week_url" "text",
    "sound_of_week_updated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shadow_profiles_bio_check" CHECK (("char_length"("bio") <= 150)),
    CONSTRAINT "shadow_profiles_social_energy_check" CHECK (("social_energy" = ANY (ARRAY['introvert'::"text", 'extrovert'::"text", 'ambivert'::"text"])))
);


ALTER TABLE "public"."shadow_profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocker_id_blocked_id_key" UNIQUE ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."connections"
    ADD CONSTRAINT "connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."connections"
    ADD CONSTRAINT "connections_requester_id_recipient_id_key" UNIQUE ("requester_id", "recipient_id");



ALTER TABLE ONLY "public"."love_soul"
    ADD CONSTRAINT "love_soul_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pov_cards"
    ADD CONSTRAINT "pov_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pov_likes"
    ADD CONSTRAINT "pov_likes_card_id_user_id_key" UNIQUE ("card_id", "user_id");



ALTER TABLE ONLY "public"."pov_likes"
    ADD CONSTRAINT "pov_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shadow_profiles"
    ADD CONSTRAINT "shadow_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shadow_profiles"
    ADD CONSTRAINT "shadow_profiles_shadow_name_key" UNIQUE ("shadow_name");



CREATE INDEX "idx_connections_code" ON "public"."connections" USING "btree" ("verification_code") WHERE (("verification_code" IS NOT NULL) AND ("status" = 'pending'::"text"));



CREATE INDEX "idx_connections_recipient_status" ON "public"."connections" USING "btree" ("recipient_id", "status");



CREATE INDEX "idx_connections_requester_status" ON "public"."connections" USING "btree" ("requester_id", "status");



CREATE INDEX "idx_interests_gin" ON "public"."shadow_profiles" USING "gin" ("interests");



CREATE INDEX "idx_messages_connection_created" ON "public"."messages" USING "btree" ("connection_id", "created_at" DESC);



CREATE INDEX "idx_notifications_recipient" ON "public"."notifications" USING "btree" ("recipient_id");



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("recipient_id") WHERE ("is_read" = false);



CREATE INDEX "idx_shadow_name_trgm" ON "public"."shadow_profiles" USING "gin" ("shadow_name" "public"."gin_trgm_ops");



CREATE OR REPLACE TRIGGER "connections_updated_at" BEFORE UPDATE ON "public"."connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "love_soul_updated_at" BEFORE UPDATE ON "public"."love_soul" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "on_like_change" AFTER INSERT OR DELETE ON "public"."pov_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_likes_count"();



CREATE OR REPLACE TRIGGER "on_message_insert" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."check_reveal_progression"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "shadow_profiles_updated_at" BEFORE UPDATE ON "public"."shadow_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."connections"
    ADD CONSTRAINT "connections_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."connections"
    ADD CONSTRAINT "connections_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."love_soul"
    ADD CONSTRAINT "love_soul_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pov_cards"
    ADD CONSTRAINT "pov_cards_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pov_likes"
    ADD CONSTRAINT "pov_likes_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."pov_cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pov_likes"
    ADD CONSTRAINT "pov_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reported_card_id_fkey" FOREIGN KEY ("reported_card_id") REFERENCES "public"."pov_cards"("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."shadow_profiles"
    ADD CONSTRAINT "shadow_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Active cards are publicly readable" ON "public"."pov_cards" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (("is_saved" = true) OR ("expires_at" > "now"()))));



CREATE POLICY "Anyone authenticated can view shadow profiles" ON "public"."shadow_profiles" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Creators can delete their own cards" ON "public"."pov_cards" FOR DELETE USING (("auth"."uid"() = "creator_id"));



CREATE POLICY "Creators can update their own cards" ON "public"."pov_cards" FOR UPDATE USING (("auth"."uid"() = "creator_id"));



CREATE POLICY "Known connections can view profiles" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."connections"
  WHERE (("connections"."status" = 'accepted'::"text") AND ("connections"."connection_type" = 'known'::"text") AND ((("connections"."requester_id" = "auth"."uid"()) AND ("connections"."recipient_id" = "profiles"."id")) OR (("connections"."recipient_id" = "auth"."uid"()) AND ("connections"."requester_id" = "profiles"."id")))))));



CREATE POLICY "Participants can mark messages as read" ON "public"."messages" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."connections"
  WHERE (("connections"."id" = "messages"."connection_id") AND (("connections"."requester_id" = "auth"."uid"()) OR ("connections"."recipient_id" = "auth"."uid"())))))) WITH CHECK (("sender_id" <> "auth"."uid"()));



CREATE POLICY "Requesters can cancel pending connections" ON "public"."connections" FOR DELETE USING ((("auth"."uid"() = "requester_id") AND ("status" = 'pending'::"text")));



CREATE POLICY "Soul-stage connections can view love soul" ON "public"."love_soul" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."connections"
  WHERE (("connections"."status" = 'accepted'::"text") AND ("connections"."reveal_stage" = ANY (ARRAY['soul'::"text", 'unfold'::"text"])) AND ((("connections"."requester_id" = "auth"."uid"()) AND ("connections"."recipient_id" = "love_soul"."id")) OR (("connections"."recipient_id" = "auth"."uid"()) AND ("connections"."requester_id" = "love_soul"."id")))))));



CREATE POLICY "Users can create connections" ON "public"."connections" FOR INSERT WITH CHECK (("auth"."uid"() = "requester_id"));



CREATE POLICY "Users can create reports" ON "public"."reports" FOR INSERT WITH CHECK (("auth"."uid"() = "reporter_id"));



CREATE POLICY "Users can create their own cards" ON "public"."pov_cards" FOR INSERT WITH CHECK (("auth"."uid"() = "creator_id"));



CREATE POLICY "Users can insert notifications for others" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."uid"() = "actor_id"));



CREATE POLICY "Users can insert own love soul" ON "public"."love_soul" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own shadow profile" ON "public"."shadow_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can like cards" ON "public"."pov_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their blocks" ON "public"."blocked_users" USING (("auth"."uid"() = "blocker_id"));



CREATE POLICY "Users can read their own messages" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."connections"
  WHERE (("connections"."id" = "messages"."connection_id") AND (("connections"."requester_id" = "auth"."uid"()) OR ("connections"."recipient_id" = "auth"."uid"()))))));



CREATE POLICY "Users can send messages in their connections" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."connections"
  WHERE (("connections"."id" = "messages"."connection_id") AND ("connections"."status" = 'accepted'::"text") AND (("connections"."requester_id" = "auth"."uid"()) OR ("connections"."recipient_id" = "auth"."uid"())))))));



CREATE POLICY "Users can unlike cards" ON "public"."pov_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own connections" ON "public"."connections" FOR UPDATE USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "recipient_id")));



CREATE POLICY "Users can update own love soul" ON "public"."love_soul" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own shadow profile" ON "public"."shadow_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own notifications (mark as read)" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "recipient_id"));



CREATE POLICY "Users can view connected profiles" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."connections"
  WHERE (((("connections"."requester_id" = "auth"."uid"()) AND ("connections"."recipient_id" = "profiles"."id")) OR (("connections"."recipient_id" = "auth"."uid"()) AND ("connections"."requester_id" = "profiles"."id"))) AND ("connections"."status" = 'accepted'::"text")))));



CREATE POLICY "Users can view likes" ON "public"."pov_likes" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can view own connections" ON "public"."connections" FOR SELECT USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "recipient_id")));



CREATE POLICY "Users can view own love soul" ON "public"."love_soul" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own reports" ON "public"."reports" FOR SELECT USING (("auth"."uid"() = "reporter_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "recipient_id"));



CREATE POLICY "Users can view unfolded connections profiles" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."connections"
  WHERE (("connections"."status" = 'accepted'::"text") AND ("connections"."reveal_stage" = 'unfold'::"text") AND ((("connections"."requester_id" = "auth"."uid"()) AND ("connections"."recipient_id" = "profiles"."id")) OR (("connections"."recipient_id" = "auth"."uid"()) AND ("connections"."requester_id" = "profiles"."id")))))));



ALTER TABLE "public"."blocked_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."love_soul" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pov_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pov_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shadow_profiles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."check_reveal_progression"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_reveal_progression"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_reveal_progression"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_likes"("card_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_likes"("card_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_likes"("card_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_expired_cards"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_expired_cards"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_expired_cards"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_likes"("card_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_likes"("card_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_likes"("card_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_messages_read"("p_connection_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_messages_read"("p_connection_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_messages_read"("p_connection_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_likes_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_likes_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_likes_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_observer_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_observer_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_observer_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."blocked_users" TO "anon";
GRANT ALL ON TABLE "public"."blocked_users" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_users" TO "service_role";



GRANT ALL ON TABLE "public"."connections" TO "anon";
GRANT ALL ON TABLE "public"."connections" TO "authenticated";
GRANT ALL ON TABLE "public"."connections" TO "service_role";



GRANT ALL ON TABLE "public"."love_soul" TO "anon";
GRANT ALL ON TABLE "public"."love_soul" TO "authenticated";
GRANT ALL ON TABLE "public"."love_soul" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."pov_cards" TO "anon";
GRANT ALL ON TABLE "public"."pov_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."pov_cards" TO "service_role";



GRANT ALL ON TABLE "public"."pov_likes" TO "anon";
GRANT ALL ON TABLE "public"."pov_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."pov_likes" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."shadow_profiles" TO "anon";
GRANT ALL ON TABLE "public"."shadow_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."shadow_profiles" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







