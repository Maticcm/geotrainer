import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { ensureUserProfile } from "@/lib/db-progress";
import { z } from "zod";

const UpdateProfileSchema = z.object({
  displayName: z.string().trim().max(100).optional(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
});

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await ensureUserProfile(session.user.id, {
      displayName: session.user.name || null,
      avatarUrl: session.user.image || null,
    });

    return NextResponse.json({
      user: session.user,
      profile,
    });
  } catch (err) {
    console.error("Failed to fetch user profile:", err);
    return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await req.json();
    const parsed = UpdateProfileSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updated = await ensureUserProfile(session.user.id, parsed.data);
    return NextResponse.json({ success: true, profile: updated });
  } catch (err) {
    console.error("Failed to update profile:", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
