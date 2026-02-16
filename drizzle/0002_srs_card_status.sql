-- Add status column to srs_card
ALTER TABLE "srs_card" ADD COLUMN "status" text NOT NULL DEFAULT 'new';

-- Make next_review_at nullable (remove NOT NULL + default)
ALTER TABLE "srs_card" ALTER COLUMN "next_review_at" DROP NOT NULL;
ALTER TABLE "srs_card" ALTER COLUMN "next_review_at" DROP DEFAULT;

-- Backfill existing cards based on their state
-- Cards never reviewed → new, nextReviewAt = NULL
UPDATE "srs_card"
SET "status" = 'new', "next_review_at" = NULL
WHERE "last_reviewed_at" IS NULL AND "repetitions" = 0;

-- Cards reviewed but < 3 reps → learning (keep their next_review_at)
UPDATE "srs_card"
SET "status" = 'learning'
WHERE "last_reviewed_at" IS NOT NULL AND "repetitions" < 3;

-- Cards with >= 3 reps → review (keep their next_review_at)
UPDATE "srs_card"
SET "status" = 'review'
WHERE "repetitions" >= 3;
