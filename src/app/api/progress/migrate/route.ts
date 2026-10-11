import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { mergeLocalProgressToCloud } from "@/lib/db-progress";
import { sanitizeProgress } from "@/lib/progress";

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await req.json();
    if (!raw || typeof raw !== "object" || !("localProgress" in raw)) {
      return NextResponse.json(
        { error: "Missing localProgress object in request body" },
        { status: 400 }
      );
    }

    const cleanLocal = sanitizeProgress(raw.localProgress);
    const merged = await mergeLocalProgressToCloud(session.user.id, cleanLocal);

    return NextResponse.json({
      success: true,
      message: "Anonymous progress successfully merged to Neon cloud account.",
      progress: merged,
    });
  } catch (err) {
    console.error("Progress migration error:", err);
    return NextResponse.json(
      { error: "Failed to merge progress into cloud account" },
      { status: 500 }
    );
  }
}
