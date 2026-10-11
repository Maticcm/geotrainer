import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { saveCloudAnswer, saveCloudSession } from "@/lib/db-progress";
import { z } from "zod";

const AnswerSyncSchema = z.object({
  type: z.literal("answer"),
  payload: z.object({
    sessionId: z.string().optional(),
    featureId: z.string().min(1),
    isCorrect: z.boolean(),
    accuracy: z.number().min(0).max(1),
    timeMs: z.number().min(0),
    pointsEarned: z.number(),
    now: z.number(),
  }),
});

const SessionSyncSchema = z.object({
  type: z.literal("session"),
  payload: z.object({
    id: z.string().min(1),
    mode: z.string().min(1),
    category: z.string().optional(),
    questionsTotal: z.number().int().min(1),
    questionsAnswered: z.number().int().min(0),
    correctAnswers: z.number().int().min(0),
    score: z.number().int(),
    bestStreak: z.number().int().min(0),
    startedAt: z.number(),
    completedAt: z.number().optional(),
  }),
});

const SyncBatchSchema = z.union([
  AnswerSyncSchema,
  SessionSyncSchema,
  z.object({
    type: z.literal("batch"),
    events: z.array(z.union([AnswerSyncSchema, SessionSyncSchema])),
  }),
]);

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await req.json();
    const parsed = SyncBatchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid sync payload format", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.type === "answer") {
      await saveCloudAnswer(session.user.id, data.payload);
    } else if (data.type === "session") {
      await saveCloudSession(session.user.id, data.payload);
    } else if (data.type === "batch") {
      for (const ev of data.events) {
        if (ev.type === "answer") {
          await saveCloudAnswer(session.user.id, ev.payload);
        } else if (ev.type === "session") {
          await saveCloudSession(session.user.id, ev.payload);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Progress synchronization error:", err);
    return NextResponse.json({ error: "Progress synchronization failed" }, { status: 500 });
  }
}
