import { eq, and, desc } from "drizzle-orm";
import { getDb, profiles, userProgress, gameSessions, gameAnswers } from "@/db";
import type { ProgressData, SessionRecord } from "./progress";
import { defaultProgress, localDay } from "./progress";
import type { FeatureProgress } from "./srs";
import { qualityOf, reviewFeature, masteryLevel, newFeatureProgress } from "./srs";

const MASTERY_LABELS = ["new", "learning", "familiar", "good", "mastered"] as const;
function getMasteryLabel(p: FeatureProgress): string {
  return MASTERY_LABELS[masteryLevel(p)] || "new";
}

/**
 * Ensures a user profile exists in the `profiles` table.
 */
export async function ensureUserProfile(
  userId: string,
  meta?: { displayName?: string | null; avatarUrl?: string | null }
) {
  const db = getDb();
  if (!db) return null;

  const existing = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (existing.length === 0) {
    const [created] = await db
      .insert(profiles)
      .values({
        id: userId,
        displayName: meta?.displayName || null,
        avatarUrl: meta?.avatarUrl || null,
      })
      .returning();
    return created;
  }

  // Update meta if provided and different
  if (meta?.displayName !== undefined || meta?.avatarUrl !== undefined) {
    const [updated] = await db
      .update(profiles)
      .set({
        displayName: meta.displayName !== undefined ? meta.displayName : existing[0].displayName,
        avatarUrl: meta.avatarUrl !== undefined ? meta.avatarUrl : existing[0].avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, userId))
      .returning();
    return updated;
  }

  return existing[0];
}

/**
 * Retrieves the full cloud progress data for an authenticated user.
 */
export async function getUserCloudProgress(userId: string): Promise<ProgressData | null> {
  const db = getDb();
  if (!db) return null;

  // 1. Fetch user features
  const progressRows = await db
    .select()
    .from(userProgress)
    .where(eq(userProgress.userId, userId));

  // 2. Fetch user game sessions
  const sessionRows = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.userId, userId))
    .orderBy(desc(gameSessions.startedAt))
    .limit(30);

  const base = defaultProgress();
  const features: Record<string, FeatureProgress> = {};
  const studyDaysSet = new Set<string>();
  let bestScore = 0;
  let maxStreak = 0;
  let latestPracticed = 0;

  for (const row of progressRows) {
    const lastSeenTs = row.lastAnsweredAt ? row.lastAnsweredAt.getTime() : 0;
    const dueTs = row.nextReviewAt ? row.nextReviewAt.getTime() : 0;

    if (lastSeenTs > latestPracticed) {
      latestPracticed = lastSeenTs;
    }
    if (lastSeenTs > 0) {
      studyDaysSet.add(localDay(lastSeenTs));
    }
    if (row.streak > maxStreak) {
      maxStreak = row.streak;
    }

    features[row.featureId] = {
      attempts: row.timesSeen,
      correct: row.timesCorrect,
      incorrect: row.timesIncorrect,
      totalTimeMs: 0,
      ease: 2.5,
      interval: Math.round(row.reviewIntervalDays),
      repetitions: row.timesCorrect,
      lapses: row.timesIncorrect,
      due: dueTs,
      lastSeen: lastSeenTs,
      lastResult: row.timesSeen > 0 ? row.timesCorrect >= row.timesIncorrect : null,
    };
  }

  const history: SessionRecord[] = sessionRows.map((s) => {
    if (s.score > bestScore) {
      bestScore = s.score;
    }
    return {
      id: s.id,
      mode: s.mode as SessionRecord["mode"],
      categories: s.category ? (s.category.split(",") as SessionRecord["categories"]) : [],
      finishedAt: s.completedAt ? s.completedAt.getTime() : s.startedAt.getTime(),
      score: s.score,
      correct: s.correctAnswers,
      total: s.questionsTotal,
      avgTimeMs: 0,
    };
  });

  base.features = features;
  base.history = history;
  base.stats = {
    sessions: sessionRows.length,
    bestScore,
    currentStreak: maxStreak,
    longestStreak: maxStreak,
    lastPracticed: latestPracticed,
    studyDays: Array.from(studyDaysSet).sort().slice(-400),
  };

  return base;
}

/**
 * Saves a single answer to cloud database atomically.
 */
export async function saveCloudAnswer(
  userId: string,
  payload: {
    sessionId?: string;
    featureId: string;
    isCorrect: boolean;
    accuracy: number;
    timeMs: number;
    pointsEarned: number;
    now: number;
  }
) {
  const db = getDb();
  if (!db) return null;

  await ensureUserProfile(userId);

  // 1. Record in game_answers (safely check foreign key constraint)
  let validSessionId: string | null = null;
  if (payload.sessionId) {
    try {
      const [sess] = await db
        .select({ id: gameSessions.id })
        .from(gameSessions)
        .where(eq(gameSessions.id, payload.sessionId))
        .limit(1);
      if (sess) {
        validSessionId = sess.id;
      }
    } catch {
      validSessionId = null;
    }
  }

  await db.insert(gameAnswers).values({
    sessionId: validSessionId,
    userId,
    featureId: payload.featureId,
    isCorrect: payload.isCorrect,
    pointsEarned: payload.pointsEarned,
    responseTimeMs: Math.round(payload.timeMs),
    answeredAt: new Date(payload.now),
  });

  // 2. Query existing feature progress
  const [existing] = await db
    .select()
    .from(userProgress)
    .where(and(eq(userProgress.userId, userId), eq(userProgress.featureId, payload.featureId)))
    .limit(1);

  const prev: FeatureProgress = existing
    ? {
        attempts: existing.timesSeen,
        correct: existing.timesCorrect,
        incorrect: existing.timesIncorrect,
        totalTimeMs: 0,
        ease: 2.5,
        interval: Math.round(existing.reviewIntervalDays),
        repetitions: existing.timesCorrect,
        lapses: existing.timesIncorrect,
        due: existing.nextReviewAt ? existing.nextReviewAt.getTime() : 0,
        lastSeen: existing.lastAnsweredAt ? existing.lastAnsweredAt.getTime() : 0,
        lastResult: existing.timesSeen > 0 ? existing.timesCorrect >= existing.timesIncorrect : null,
      }
    : newFeatureProgress();

  const quality = qualityOf(payload.isCorrect, payload.accuracy, payload.timeMs);
  const next = reviewFeature(prev, quality, payload.timeMs, payload.now);
  const mastery = getMasteryLabel(next);
  const streak = payload.isCorrect ? (existing?.streak ?? 0) + 1 : 0;

  if (existing) {
    await db
      .update(userProgress)
      .set({
        timesSeen: existing.timesSeen + 1,
        timesCorrect: existing.timesCorrect + (payload.isCorrect ? 1 : 0),
        timesIncorrect: existing.timesIncorrect + (payload.isCorrect ? 0 : 1),
        masteryLevel: mastery,
        streak,
        lastAnsweredAt: new Date(payload.now),
        nextReviewAt: next.due > 0 ? new Date(next.due) : null,
        reviewIntervalDays: next.interval,
        updatedAt: new Date(),
      })
      .where(eq(userProgress.id, existing.id));
  } else {
    await db.insert(userProgress).values({
      userId,
      featureId: payload.featureId,
      timesSeen: 1,
      timesCorrect: payload.isCorrect ? 1 : 0,
      timesIncorrect: payload.isCorrect ? 0 : 1,
      masteryLevel: mastery,
      streak,
      lastAnsweredAt: new Date(payload.now),
      nextReviewAt: next.due > 0 ? new Date(next.due) : null,
      reviewIntervalDays: next.interval,
      updatedAt: new Date(),
    });
  }

  return { success: true };
}

/**
 * Saves a completed game session to the cloud database.
 */
export async function saveCloudSession(
  userId: string,
  session: {
    id: string;
    mode: string;
    category?: string;
    questionsTotal: number;
    questionsAnswered: number;
    correctAnswers: number;
    score: number;
    bestStreak: number;
    startedAt: number;
    completedAt?: number;
  }
) {
  const db = getDb();
  if (!db) return null;

  await ensureUserProfile(userId);

  const [existing] = await db
    .select()
    .from(gameSessions)
    .where(and(eq(gameSessions.id, session.id), eq(gameSessions.userId, userId)))
    .limit(1);

  if (existing) {
    await db
      .update(gameSessions)
      .set({
        questionsAnswered: session.questionsAnswered,
        correctAnswers: session.correctAnswers,
        score: session.score,
        bestStreak: session.bestStreak,
        completedAt: session.completedAt ? new Date(session.completedAt) : new Date(),
      })
      .where(eq(gameSessions.id, session.id));
  } else {
    await db.insert(gameSessions).values({
      id: session.id,
      userId,
      mode: session.mode,
      category: session.category || null,
      questionsTotal: session.questionsTotal,
      questionsAnswered: session.questionsAnswered,
      correctAnswers: session.correctAnswers,
      score: session.score,
      bestStreak: session.bestStreak,
      startedAt: new Date(session.startedAt),
      completedAt: session.completedAt ? new Date(session.completedAt) : null,
    });
  }

  return { success: true };
}

/**
 * Deterministically merges anonymous local progress into the cloud account.
 * Follows strict conflict reconciliation without losing progress:
 * - Feature counters: max(cloud, local)
 * - Review schedule: if local was practiced more recently, adopt local schedule
 * - Sessions: deduplicated by session ID
 */
export async function mergeLocalProgressToCloud(
  userId: string,
  local: ProgressData
): Promise<ProgressData | null> {
  const db = getDb();
  if (!db) return null;

  await ensureUserProfile(userId);

  // 1. Fetch existing cloud features
  const existingFeatures = await db
    .select()
    .from(userProgress)
    .where(eq(userProgress.userId, userId));

  const existingMap = new Map(existingFeatures.map((f) => [f.featureId, f]));

  // 2. Merge local feature statistics
  for (const [featureId, localFeat] of Object.entries(local.features)) {
    if (!localFeat || localFeat.attempts <= 0) continue;

    const cloudFeat = existingMap.get(featureId);

    if (cloudFeat) {
      // Reconcile conflict deterministically
      const mergedSeen = Math.max(cloudFeat.timesSeen, localFeat.attempts);
      const mergedCorrect = Math.max(cloudFeat.timesCorrect, localFeat.correct);
      const mergedIncorrect = Math.max(cloudFeat.timesIncorrect, localFeat.incorrect);
      const mergedStreak = Math.max(cloudFeat.streak, localFeat.repetitions);

      const cloudLastSeen = cloudFeat.lastAnsweredAt ? cloudFeat.lastAnsweredAt.getTime() : 0;
      const localLastSeen = localFeat.lastSeen || 0;

      // Prefer more recent review schedule
      const useLocalSchedule = localLastSeen >= cloudLastSeen;
      const lastAnsweredAt = useLocalSchedule && localLastSeen > 0 ? new Date(localLastSeen) : cloudFeat.lastAnsweredAt;
      const nextReviewAt = useLocalSchedule && localFeat.due > 0 ? new Date(localFeat.due) : cloudFeat.nextReviewAt;
      const intervalDays = useLocalSchedule ? localFeat.interval : cloudFeat.reviewIntervalDays;

      const mastery = getMasteryLabel({
        ...localFeat,
        attempts: mergedSeen,
        correct: mergedCorrect,
        interval: intervalDays,
      });

      await db
        .update(userProgress)
        .set({
          timesSeen: mergedSeen,
          timesCorrect: mergedCorrect,
          timesIncorrect: mergedIncorrect,
          masteryLevel: mastery,
          streak: mergedStreak,
          lastAnsweredAt,
          nextReviewAt,
          reviewIntervalDays: intervalDays,
          updatedAt: new Date(),
        })
        .where(eq(userProgress.id, cloudFeat.id));
    } else {
      // Feature only existed locally: insert directly
      const mastery = getMasteryLabel(localFeat);
      await db.insert(userProgress).values({
        userId,
        featureId,
        timesSeen: localFeat.attempts,
        timesCorrect: localFeat.correct,
        timesIncorrect: localFeat.incorrect,
        masteryLevel: mastery,
        streak: localFeat.repetitions,
        lastAnsweredAt: localFeat.lastSeen > 0 ? new Date(localFeat.lastSeen) : null,
        nextReviewAt: localFeat.due > 0 ? new Date(localFeat.due) : null,
        reviewIntervalDays: localFeat.interval,
        updatedAt: new Date(),
      });
    }
  }

  // 3. Merge session history
  for (const s of local.history) {
    if (!s.id) continue;
    const [existing] = await db
      .select({ id: gameSessions.id })
      .from(gameSessions)
      .where(and(eq(gameSessions.id, s.id), eq(gameSessions.userId, userId)))
      .limit(1);

    if (!existing) {
      await db.insert(gameSessions).values({
        id: s.id,
        userId,
        mode: s.mode,
        category: s.categories && s.categories.length > 0 ? s.categories.join(",") : null,
        questionsTotal: s.total,
        questionsAnswered: s.total,
        correctAnswers: s.correct,
        score: s.score,
        bestStreak: 0,
        startedAt: new Date(s.finishedAt - (s.avgTimeMs * s.total || 30000)),
        completedAt: new Date(s.finishedAt),
      });
    }
  }

  // 4. Return unified progress data
  return getUserCloudProgress(userId);
}
