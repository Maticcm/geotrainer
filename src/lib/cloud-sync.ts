"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { ProgressData, AnswerRecord, SessionRecord } from "./progress";
import { getProgress, updateProgress } from "./store";
import { authClient, type AuthUser } from "./auth-client";

const SYNC_QUEUE_KEY = "geotrainer:sync_queue";
const LAST_SYNCED_KEY = "geotrainer:last_synced";

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

interface QueuedSyncItem {
  id: string;
  type: "answer" | "session";
  payload: Record<string, unknown>;
  createdAt: number;
}

function getSyncQueue(): QueuedSyncItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSyncQueue(items: QueuedSyncItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* ignore storage quota errors */
  }
}

/**
 * Enqueues an answer to be synced with the Neon cloud database.
 */
export async function queueCloudAnswer(a: AnswerRecord, sessionId?: string) {
  const item: QueuedSyncItem = {
    id: `ans_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: "answer",
    payload: {
      sessionId,
      featureId: a.featureId,
      isCorrect: a.correct,
      accuracy: a.accuracy,
      timeMs: a.timeMs,
      pointsEarned: a.correct ? Math.round(100 * a.accuracy) : 0,
      now: a.now,
    },
    createdAt: Date.now(),
  };

  const queue = [...getSyncQueue(), item].slice(-100);
  saveSyncQueue(queue);
  flushSyncQueue();
}

/**
 * Enqueues a completed session to be synced with the Neon cloud database.
 */
export async function queueCloudSession(s: SessionRecord) {
  const item: QueuedSyncItem = {
    id: `sess_${s.id}`,
    type: "session",
    payload: {
      id: s.id,
      mode: s.mode,
      category: s.categories.join(",") || undefined,
      questionsTotal: s.total,
      questionsAnswered: s.total,
      correctAnswers: s.correct,
      score: s.score,
      bestStreak: 0,
      startedAt: s.finishedAt - (s.avgTimeMs * s.total || 30000),
      completedAt: s.finishedAt,
    },
    createdAt: Date.now(),
  };

  const queue = [...getSyncQueue(), item].slice(-100);
  saveSyncQueue(queue);
  flushSyncQueue();
}

let isFlushing = false;

/**
 * Flushes all pending items in the sync queue to `/api/progress/sync`.
 */
export async function flushSyncQueue(): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.onLine || isFlushing) return false;

  const queue = getSyncQueue();
  if (queue.length === 0) return true;

  isFlushing = true;
  try {
    const events = queue.map((q) => ({
      type: q.type,
      payload: q.payload,
    }));

    const res = await fetch("/api/progress/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "batch", events }),
    });

    if (res.ok) {
      localStorage.removeItem(SYNC_QUEUE_KEY);
      localStorage.setItem(LAST_SYNCED_KEY, String(Date.now()));
      return true;
    } else if (res.status === 401) {
      // User is not logged in: items remain queued in localStorage until login
      return false;
    }
    return false;
  } catch {
    return false;
  } finally {
    isFlushing = false;
  }
}

/**
 * Migrates local anonymous progress to cloud account.
 */
export async function migrateLocalProgressToCloud(): Promise<ProgressData | null> {
  const local = getProgress();
  try {
    const res = await fetch("/api/progress/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localProgress: local }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.progress) {
        // Update local store with unified merged progress
        updateProgress(() => data.progress);
        localStorage.setItem(LAST_SYNCED_KEY, String(Date.now()));
        return data.progress;
      }
    }
    return null;
  } catch (err) {
    console.error("Failed to migrate progress:", err);
    return null;
  }
}

/**
 * React hook for managing user cloud sync status, offline awareness, and migration.
 */
export function useCloudSync() {
  const { data: session, isPending } = authClient.useSession();
  const user = (session?.user as AuthUser | undefined) ?? null;

  const [status, setStatus] = useState<SyncStatus>("idle");
  const [pendingCount, setPendingCount] = useState(() =>
    typeof window !== "undefined" ? getSyncQueue().length : 0
  );
  const [hasAnonymousData, setHasAnonymousData] = useState(() => {
    if (typeof window === "undefined") return false;
    const local = getProgress();
    return Object.values(local.features).some((f) => f.attempts > 0) || local.history.length > 0;
  });
  const [isMigrating, setIsMigrating] = useState(false);
  const hasAutoFetchedRef = useRef(false);

  // Update pending queue count
  const updatePending = useCallback(() => {
    setPendingCount(getSyncQueue().length);
    const local = getProgress();
    setHasAnonymousData(
      Object.values(local.features).some((f) => f.attempts > 0) || local.history.length > 0
    );
  }, []);

  // Synchronize with server on login
  useEffect(() => {
    if (!user || hasAutoFetchedRef.current) return;
    hasAutoFetchedRef.current = true;

    async function initialCloudFetch() {
      setStatus("syncing");
      try {
        const res = await fetch("/api/progress");
        if (res.ok) {
          const data = await res.json();
          if (data.progress) {
            // If cloud has records, merge or sync with local store
            const cloudProgress = data.progress as ProgressData;
            const hasCloudStats =
              Object.keys(cloudProgress.features).length > 0 || cloudProgress.history.length > 0;

            if (hasCloudStats) {
              updateProgress((local) => {
                // If local was empty, adopt cloud immediately
                const localHasData =
                  Object.keys(local.features).length > 0 || local.history.length > 0;
                if (!localHasData) {
                  return { ...cloudProgress, settings: local.settings };
                }
                return local;
              });
            }
          }
          await flushSyncQueue();
          setStatus("synced");
        } else {
          setStatus("idle");
        }
      } catch {
        setStatus("offline");
      }
    }

    initialCloudFetch();
  }, [user]);

  // Online / offline listeners
  useEffect(() => {
    const onOnline = () => {
      setStatus("syncing");
      flushSyncQueue().then((success) => {
        setStatus(success ? "synced" : "idle");
        updatePending();
      });
    };

    const onOffline = () => {
      setStatus("offline");
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [updatePending]);

  const migrate = useCallback(async () => {
    setIsMigrating(true);
    setStatus("syncing");
    const res = await migrateLocalProgressToCloud();
    setIsMigrating(false);
    if (res) {
      setStatus("synced");
      setHasAnonymousData(false);
      updatePending();
      return true;
    }
    setStatus("error");
    return false;
  }, [updatePending]);

  return {
    user,
    isAuthLoading: isPending,
    status,
    pendingCount,
    hasAnonymousData,
    isMigrating,
    migrate,
  };
}
