import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getUserCloudProgress } from "@/lib/db-progress";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const progress = await getUserCloudProgress(session.user.id);
    return NextResponse.json({ progress, user: session.user });
  } catch (err) {
    console.error("Failed to fetch cloud progress:", err);
    return NextResponse.json({ error: "Failed to fetch cloud progress" }, { status: 500 });
  }
}
