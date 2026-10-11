import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  real,
  unique,
  index,
} from "drizzle-orm/pg-core";

/**
 * User Profiles
 * Primary key `id` matches the authenticated user ID provided by Neon Auth.
 */
export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * User Geography Feature Progress
 * Tracks spaced repetition (SRS) and mastery counters per feature for each user.
 */
export const userProgress = pgTable(
  "user_progress",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    featureId: text("feature_id").notNull(),
    timesSeen: integer("times_seen").default(0).notNull(),
    timesCorrect: integer("times_correct").default(0).notNull(),
    timesIncorrect: integer("times_incorrect").default(0).notNull(),
    masteryLevel: text("mastery_level").default("new").notNull(),
    streak: integer("streak").default(0).notNull(),
    lastAnsweredAt: timestamp("last_answered_at", { withTimezone: true }),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    reviewIntervalDays: real("review_interval_days").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("user_progress_user_feature_unique").on(table.userId, table.featureId),
    index("user_progress_user_id_idx").on(table.userId),
    index("user_progress_feature_id_idx").on(table.featureId),
  ]
);

/**
 * Game Sessions
 * Historical record of completed and in-progress quiz sessions.
 */
export const gameSessions = pgTable(
  "game_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    category: text("category"),
    questionsTotal: integer("questions_total").notNull(),
    questionsAnswered: integer("questions_answered").default(0).notNull(),
    correctAnswers: integer("correct_answers").default(0).notNull(),
    score: integer("score").default(0).notNull(),
    bestStreak: integer("best_streak").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("game_sessions_user_id_idx").on(table.userId),
    index("game_sessions_started_at_idx").on(table.startedAt),
  ]
);

/**
 * Individual Game Answers
 * Detailed history of student answers for analytics, mastery evaluation, and review.
 */
export const gameAnswers = pgTable(
  "game_answers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id").references(() => gameSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    featureId: text("feature_id").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    pointsEarned: integer("points_earned").default(0).notNull(),
    responseTimeMs: integer("response_time_ms").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("game_answers_user_id_idx").on(table.userId),
    index("game_answers_session_id_idx").on(table.sessionId),
    index("game_answers_feature_id_idx").on(table.featureId),
  ]
);

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;
export type UserProgressRecord = typeof userProgress.$inferSelect;
export type InsertUserProgress = typeof userProgress.$inferInsert;
export type GameSessionRecord = typeof gameSessions.$inferSelect;
export type InsertGameSession = typeof gameSessions.$inferInsert;
export type GameAnswerRecord = typeof gameAnswers.$inferSelect;
export type InsertGameAnswer = typeof gameAnswers.$inferInsert;
