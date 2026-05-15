CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean NOT NULL,
  "image" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp,
  "updated_at" timestamp
);

CREATE TABLE IF NOT EXISTS "user_stats" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "current_streak" integer DEFAULT 0 NOT NULL,
  "longest_streak" integer DEFAULT 0 NOT NULL,
  "last_practice_date" date,
  "total_lessons_completed" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_preferences" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "native_language" text,
  "target_language" text,
  "preferred_model" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "course" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "source_language" text NOT NULL,
  "target_language" text NOT NULL,
  "level" text NOT NULL,
  "visibility" text,
  "published" boolean DEFAULT true NOT NULL,
  "created_by" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "unit" (
  "id" text PRIMARY KEY NOT NULL,
  "course_id" text REFERENCES "course"("id") ON DELETE set null,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "icon" text NOT NULL,
  "color" text NOT NULL,
  "markdown" text NOT NULL,
  "target_language" text NOT NULL,
  "source_language" text,
  "level" text,
  "visibility" text,
  "created_by" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_course_enrollment" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "course_id" text NOT NULL,
  "current_unit_id" text,
  "current_lesson_index" integer DEFAULT 0 NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "enrollment_unique" ON "user_course_enrollment" ("user_id", "course_id");

CREATE TABLE IF NOT EXISTS "lesson_completion" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "unit_id" text NOT NULL REFERENCES "unit"("id") ON DELETE cascade,
  "lesson_index" integer NOT NULL,
  "perfect_score" boolean DEFAULT false NOT NULL,
  "completed_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lesson_completion_user_unit" ON "lesson_completion" ("user_id", "unit_id");

CREATE TABLE IF NOT EXISTS "exercise_attempt" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "lesson_completion_id" text NOT NULL REFERENCES "lesson_completion"("id") ON DELETE cascade,
  "exercise_index" integer NOT NULL,
  "exercise_type" text NOT NULL,
  "correct" boolean NOT NULL,
  "user_answer" text
);

CREATE TABLE IF NOT EXISTS "daily_activity" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "date" date NOT NULL,
  "lessons_completed" integer DEFAULT 0 NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "daily_activity_unique" ON "daily_activity" ("user_id", "date");

CREATE TABLE IF NOT EXISTS "srs_card" (
  "word" text NOT NULL,
  "language" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "translation" text NOT NULL,
  "cefr_level" text,
  "pos" text,
  "gender" text,
  "example_native" text,
  "example_english" text,
  "status" text DEFAULT 'new' NOT NULL,
  "ease_factor" real DEFAULT 2.5 NOT NULL,
  "interval" integer DEFAULT 0 NOT NULL,
  "repetitions" integer DEFAULT 0 NOT NULL,
  "next_review_at" timestamp,
  "last_reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("word", "language", "user_id")
);
CREATE INDEX IF NOT EXISTS "srs_user_lang_status_review" ON "srs_card" ("user_id", "language", "status", "next_review_at");

CREATE TABLE IF NOT EXISTS "dictionary_word" (
  "id" text PRIMARY KEY NOT NULL,
  "word" text NOT NULL,
  "language" text NOT NULL,
  "pos" text,
  "cefr_level" text,
  "english_translation" text NOT NULL,
  "example_sentence_native" text,
  "example_sentence_english" text,
  "gender" text,
  "word_frequency" integer,
  "useful_for_flashcard" boolean DEFAULT true,
  "goethe_b1_wordlist" boolean
);
CREATE UNIQUE INDEX IF NOT EXISTS "dictionary_word_unique" ON "dictionary_word" ("word", "language");

CREATE TABLE IF NOT EXISTS "word_cache" (
  "id" text PRIMARY KEY NOT NULL,
  "word" text NOT NULL,
  "language" text NOT NULL,
  "base_form" text,
  "translation" text NOT NULL,
  "pos" text,
  "gender" text,
  "cefr_level" text,
  "example_native" text,
  "example_english" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "word_cache_unique" ON "word_cache" ("word", "language");

CREATE TABLE IF NOT EXISTS "user_memory" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_memory_unique" ON "user_memory" ("user_id", "key");

CREATE TABLE IF NOT EXISTS "user_unit_library" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "unit_id" text NOT NULL REFERENCES "unit"("id") ON DELETE cascade,
  "added_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_unit_library_unique" ON "user_unit_library" ("user_id", "unit_id");

CREATE TABLE IF NOT EXISTS "audio_cache" (
  "id" text PRIMARY KEY NOT NULL,
  "text" text NOT NULL,
  "language" text NOT NULL,
  "r2_key" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "audio_cache_unique" ON "audio_cache" ("text", "language");

CREATE TABLE IF NOT EXISTS "chat_conversation" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "language" text NOT NULL,
  "messages" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "chat_conversation_user_updated" ON "chat_conversation" ("user_id", "updated_at" DESC);

CREATE TABLE IF NOT EXISTS "article" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "source_url" text NOT NULL,
  "title" text,
  "source_language" text,
  "target_language" text NOT NULL,
  "cefr_level" text NOT NULL,
  "original_content" text,
  "translated_content" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "translation_progress" integer DEFAULT 0 NOT NULL,
  "total_paragraphs" integer DEFAULT 0 NOT NULL,
  "error_message" text,
  "word_count" integer,
  "audio_url" text,
  "audio_duration_seconds" integer,
  "audio_timestamps" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "article_user_created" ON "article" ("user_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "payload" jsonb NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "run_at" timestamp DEFAULT now() NOT NULL,
  "locked_at" timestamp,
  "last_error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "jobs_claim" ON "jobs" ("status", "run_at", "locked_at");
