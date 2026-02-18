import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  date,
  real,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Better Auth tables ───

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ─── Custom app tables ───

export const userStats = pgTable("user_stats", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastPracticeDate: date("last_practice_date"),
  totalLessonsCompleted: integer("total_lessons_completed").notNull().default(0),
  nativeLanguage: text("native_language"),
});

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  targetLanguage: text("target_language"),
  preferredModel: text("preferred_model"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userCourseEnrollment = pgTable(
  "user_course_enrollment",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id").notNull(),
    currentUnitId: text("current_unit_id"),
    currentLessonIndex: integer("current_lesson_index").notNull().default(0),
  },
  (table) => [uniqueIndex("enrollment_unique").on(table.userId, table.courseId)]
);

export const lessonCompletion = pgTable("lesson_completion", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  unitId: text("unit_id")
    .notNull()
    .references(() => unit.id, { onDelete: "cascade" }),
  lessonIndex: integer("lesson_index").notNull(),
  perfectScore: boolean("perfect_score").notNull().default(false),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export const exerciseAttempt = pgTable("exercise_attempt", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  lessonCompletionId: text("lesson_completion_id")
    .notNull()
    .references(() => lessonCompletion.id, { onDelete: "cascade" }),
  exerciseIndex: integer("exercise_index").notNull(),
  exerciseType: text("exercise_type").notNull(),
  correct: boolean("correct").notNull(),
  userAnswer: text("user_answer"),
});

export const dailyActivity = pgTable(
  "daily_activity",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    lessonsCompleted: integer("lessons_completed").notNull().default(0),
  },
  (table) => [
    uniqueIndex("daily_activity_unique").on(table.userId, table.date),
  ]
);

// ─── Spaced repetition (SRS) ───

export const srsCard = pgTable(
  "srs_card",
  {
    word: text("word").notNull(), // always stored lowercase
    language: text("language").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    translation: text("translation").notNull(),
    cefrLevel: text("cefr_level"),
    pos: text("pos"),
    gender: text("gender"),
    exampleNative: text("example_native"),
    exampleEnglish: text("example_english"),
    status: text("status").notNull().default("new"),
    easeFactor: real("ease_factor").notNull().default(2.5),
    interval: integer("interval").notNull().default(0), // days
    repetitions: integer("repetitions").notNull().default(0),
    nextReviewAt: timestamp("next_review_at"),
    lastReviewedAt: timestamp("last_reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.word, table.language, table.userId] }),
  ]
);

// ─── Dictionary words (seeded from JSON) ───

export const dictionaryWord = pgTable(
  "dictionary_word",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    word: text("word").notNull(),
    language: text("language").notNull(),
    pos: text("pos"),
    cefrLevel: text("cefr_level"),
    englishTranslation: text("english_translation").notNull(),
    exampleSentenceNative: text("example_sentence_native"),
    exampleSentenceEnglish: text("example_sentence_english"),
    gender: text("gender"),
    wordFrequency: integer("word_frequency"),
    usefulForFlashcard: boolean("useful_for_flashcard").default(true),
  },
  (table) => [
    uniqueIndex("dictionary_word_unique").on(table.word, table.language),
  ]
);

// ─── Word cache (AI lookup results) ───

export const wordCache = pgTable(
  "word_cache",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    word: text("word").notNull(),
    language: text("language").notNull(),
    baseForm: text("base_form"),
    translation: text("translation").notNull(),
    pos: text("pos"),
    gender: text("gender"),
    cefrLevel: text("cefr_level"),
    exampleNative: text("example_native"),
    exampleEnglish: text("example_english"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("word_cache_unique").on(table.word, table.language),
  ]
);

// ─── User memory (AI context) ───

export const userMemory = pgTable(
  "user_memory",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_memory_unique").on(table.userId, table.key),
  ]
);

// ─── Course content tables ───

export const course = pgTable("course", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  sourceLanguage: text("source_language").notNull(),
  targetLanguage: text("target_language").notNull(),
  level: text("level").notNull(),
  published: boolean("published").notNull().default(true),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const unit = pgTable("unit", {
  id: text("id").primaryKey(),
  courseId: text("course_id").references(() => course.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  exercises: jsonb("exercises").notNull(),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Audio cache (TTS) ───

export const audioCache = pgTable(
  "audio_cache",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    text: text("text").notNull(),
    language: text("language").notNull(),
    r2Key: text("r2_key").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("audio_cache_unique").on(table.text, table.language),
  ]
);

// ─── Chat conversations ───

export const chatConversation = pgTable("chat_conversation", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  language: text("language").notNull(),
  messages: jsonb("messages").notNull().$type<unknown[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Articles (translated reading) ───

export const article = pgTable("article", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url").notNull(),
  title: text("title"),
  sourceLanguage: text("source_language"),
  targetLanguage: text("target_language").notNull(),
  cefrLevel: text("cefr_level").notNull(),
  originalContent: text("original_content"),
  translatedContent: text("translated_content"),
  status: text("status").notNull().default("pending"),
  translationProgress: integer("translation_progress").notNull().default(0),
  totalParagraphs: integer("total_paragraphs").notNull().default(0),
  errorMessage: text("error_message"),
  wordCount: integer("word_count"),
  audioUrl: text("audio_url"),
  audioDurationSeconds: integer("audio_duration_seconds"),
  audioTimestamps: text("audio_timestamps"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Relations ───

export const courseRelations = relations(course, ({ many }) => ({
  units: many(unit),
}));

export const unitRelations = relations(unit, ({ one }) => ({
  course: one(course, { fields: [unit.courseId], references: [course.id] }),
}));
