CREATE TABLE "course" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"source_language" text NOT NULL,
	"target_language" text NOT NULL,
	"level" text NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson" (
	"id" text PRIMARY KEY NOT NULL,
	"unit_id" text NOT NULL,
	"title" text NOT NULL,
	"order" integer NOT NULL,
	"xp_reward" integer NOT NULL,
	"exercises" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srs_card" (
	"word" text NOT NULL,
	"language" text NOT NULL,
	"user_id" text NOT NULL,
	"translation" text NOT NULL,
	"ease_factor" real DEFAULT 2.5 NOT NULL,
	"interval" integer DEFAULT 0 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"next_review_at" timestamp DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "srs_card_word_language_user_id_pk" PRIMARY KEY("word","language","user_id")
);
--> statement-breakpoint
CREATE TABLE "unit" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"order" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_stats" ADD COLUMN "native_language" text;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_card" ADD CONSTRAINT "srs_card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;