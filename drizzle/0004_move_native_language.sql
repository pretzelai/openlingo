ALTER TABLE "user_preferences" ADD COLUMN "native_language" text;--> statement-breakpoint

-- Migrate existing data from user_stats to user_preferences
INSERT INTO "user_preferences" ("user_id", "native_language", "updated_at")
SELECT "user_id", "native_language", NOW()
FROM "user_stats"
WHERE "native_language" IS NOT NULL
ON CONFLICT ("user_id") DO UPDATE SET "native_language" = EXCLUDED."native_language", "updated_at" = NOW();--> statement-breakpoint

ALTER TABLE "user_stats" DROP COLUMN "native_language";
