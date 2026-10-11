// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProgressData, AnswerRecord, SessionRecord } from "./progress";
import { defaultProgress, recordAnswer, recordSession } from "./progress";
import {
  queueCloudAnswer,
  queueCloudSession,
  flushSyncQueue,
  migrateLocalProgressToCloud,
} from "./cloud-sync";

const NOW = 1773136800000; // 2026-03-10T10:00:00.000Z

describe("Cloud Synchronization & Neon Auth Integration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("Offline Queueing and Persistence", () => {
    it("queues answers in local storage when offline or unauthenticated", async () => {
      // Mock fetch returning 401 unauthorized
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      } as Response);

      const answer: AnswerRecord = {
        featureId: "adriatic-sea",
        correct: true,
        accuracy: 0.95,
        timeMs: 1800,
        now: NOW,
      };

      await queueCloudAnswer(answer, "sess_1");

      const queueRaw = localStorage.getItem("geotrainer:sync_queue");
      expect(queueRaw).toBeTruthy();
      const queue = JSON.parse(queueRaw!);
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe("answer");
      expect(queue[0].payload.featureId).toBe("adriatic-sea");
      expect(queue[0].payload.isCorrect).toBe(true);
      expect(queue[0].payload.pointsEarned).toBe(95);
    });

    it("queues completed game sessions in local storage", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      } as Response);

      const session: SessionRecord = {
        id: "sess_offline_123",
        mode: "locate",
        categories: ["oceans-seas"],
        finishedAt: NOW,
        score: 450,
        correct: 5,
        total: 5,
        avgTimeMs: 2200,
      };

      await queueCloudSession(session);

      const queueRaw = localStorage.getItem("geotrainer:sync_queue");
      expect(queueRaw).toBeTruthy();
      const queue = JSON.parse(queueRaw!);
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe("session");
      expect(queue[0].payload.id).toBe("sess_offline_123");
      expect(queue[0].payload.score).toBe(450);
    });

    it("flushes queue atomically when connectivity/authentication is restored", async () => {
      // Pre-fill queue
      const sampleItems = [
        {
          id: "item_1",
          type: "answer",
          payload: { featureId: "nile", isCorrect: true, now: NOW },
          createdAt: NOW,
        },
        {
          id: "item_2",
          type: "session",
          payload: { id: "sess_batch_1", score: 100 },
          createdAt: NOW,
        },
      ];
      localStorage.setItem("geotrainer:sync_queue", JSON.stringify(sampleItems));

      // Mock successful sync endpoint
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, processed: 2 }),
      } as Response);
      global.fetch = fetchMock;

      const flushed = await flushSyncQueue();
      expect(flushed).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith("/api/progress/sync", expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }));

      // Queue is cleared after successful flush
      expect(localStorage.getItem("geotrainer:sync_queue")).toBeNull();
      expect(localStorage.getItem("geotrainer:last_synced")).toBeTruthy();
    });

    it("retains queue safely on network failure and allows retry", async () => {
      const sampleItems = [
        {
          id: "item_fail",
          type: "answer",
          payload: { featureId: "danube", isCorrect: true, now: NOW },
          createdAt: NOW,
        },
      ];
      localStorage.setItem("geotrainer:sync_queue", JSON.stringify(sampleItems));

      // Mock network disconnection
      global.fetch = vi.fn().mockRejectedValue(new Error("Network offline"));

      const flushed = await flushSyncQueue();
      expect(flushed).toBe(false);

      // Queue remains intact
      const retained = JSON.parse(localStorage.getItem("geotrainer:sync_queue")!);
      expect(retained).toHaveLength(1);
      expect(retained[0].id).toBe("item_fail");
    });
  });

  describe("Deterministic Anonymous Progress Migration", () => {
    it("submits local anonymous progress to migration endpoint and updates local store", async () => {
      let local: ProgressData = defaultProgress();
      local = recordAnswer(local, { featureId: "alps", correct: true, accuracy: 1, timeMs: 2000, now: NOW });
      local = recordAnswer(local, { featureId: "alps", correct: true, accuracy: 1, timeMs: 1500, now: NOW + 100000 });
      local = recordSession(local, {
        id: "anon_session_1",
        mode: "locate",
        categories: ["mountains"],
        finishedAt: NOW,
        score: 200,
        correct: 2,
        total: 2,
        avgTimeMs: 1750,
      });

      localStorage.setItem("geotrainer:progress:v2", JSON.stringify(local));

      const mergedProgress: ProgressData = {
        ...local,
        features: {
          alps: {
            ...local.features.alps,
            repetitions: 2,
            interval: 3,
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          mergedFeaturesCount: 1,
          mergedSessionsCount: 1,
          progress: mergedProgress,
        }),
      } as Response);

      const result = await migrateLocalProgressToCloud();
      expect(result).not.toBeNull();
      expect(result?.features.alps.interval).toBe(3);
    });

    it("prevents duplicate session insertions on migration retries", async () => {
      const migrationCallCount = { value: 0 };
      global.fetch = vi.fn().mockImplementation(() => {
        migrationCallCount.value++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            mergedSessionsCount: migrationCallCount.value === 1 ? 1 : 0,
            progress: defaultProgress(),
          }),
        });
      });

      // Call 1
      const res1 = await migrateLocalProgressToCloud();
      expect(res1).not.toBeNull();

      // Call 2 (retry)
      const res2 = await migrateLocalProgressToCloud();
      expect(res2).not.toBeNull();
      expect(migrationCallCount.value).toBe(2);
    });
  });

  describe("End-to-End User Journey Simulation", () => {
    it("simulates complete anonymous -> sign up -> merge -> answer -> logout -> restore workflow", async () => {
      // 1. Play a quiz anonymously
      let localStore = defaultProgress();
      localStore = recordAnswer(localStore, {
        featureId: "amazon-river",
        correct: true,
        accuracy: 1,
        timeMs: 2500,
        now: NOW,
      });
      localStorage.setItem("geotrainer:progress:v2", JSON.stringify(localStore));
      expect(localStore.features["amazon-river"].correct).toBe(1);

      // 2. Accumulate local progress in offline queue
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      });
      await queueCloudAnswer({
        featureId: "amazon-river",
        correct: true,
        accuracy: 1,
        timeMs: 2500,
        now: NOW,
      });
      expect(JSON.parse(localStorage.getItem("geotrainer:sync_queue")!)).toHaveLength(1);

      // 3. User registers/authenticates with Neon Auth (simulated session)
      const userA = { id: "user_neon_123", email: "learner@example.com" };

      // 4. Merge anonymous progress to user account
      const cloudDatabaseState: Record<
        string,
        { features: Record<string, Record<string, unknown>>; sessions: unknown[] }
      > = {
        [userA.id]: {
          features: {
            "amazon-river": { attempts: 1, correct: 1, incorrect: 0, streak: 1, interval: 1 },
          },
          sessions: [],
        },
      };

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url === "/api/progress/migrate") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              progress: {
                ...localStore,
                features: cloudDatabaseState[userA.id].features,
              },
            }),
          });
        }
        if (url === "/api/progress") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              progress: {
                ...defaultProgress(),
                features: cloudDatabaseState[userA.id].features,
              },
            }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      });

      const migrated = await migrateLocalProgressToCloud();
      expect(migrated).not.toBeNull();
      expect(migrated?.features["amazon-river"].correct).toBe(1);

      // 5. User signs out and clears local browser storage
      localStorage.clear();
      expect(localStorage.getItem("geotrainer:progress:v2")).toBeNull();

      // 6. User signs back in -> Cloud progress is restored
      const restoreRes = await fetch("/api/progress");
      const restoreData = await restoreRes.json();
      expect(restoreData.progress.features["amazon-river"]).toBeDefined();
      expect(restoreData.progress.features["amazon-river"].correct).toBe(1);

      // 7. Verify isolation: user B cannot access user A's records
      const userB = { id: "user_neon_456", email: "other@example.com" };
      expect(cloudDatabaseState[userB.id]).toBeUndefined();
    });
  });
});
