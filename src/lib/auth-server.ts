import { createNeonAuth } from "@neondatabase/auth/next/server";

export interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    emailVerified?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  };
  session?: {
    id: string;
    userId: string;
    expiresAt: Date;
    token?: string;
  };
}

export function isNeonAuthConfigured(): boolean {
  const url = process.env.NEON_AUTH_BASE_URL?.trim();
  const secret = process.env.NEON_AUTH_COOKIE_SECRET?.trim();
  return Boolean(url && secret && secret.length >= 32);
}

// Fallback secret of >= 32 chars for safe build/initialization when env is missing
const DUMMY_SECRET = "01234567890123456789012345678901";

let authInstance: ReturnType<typeof createNeonAuth> | null = null;

export function getAuth(): ReturnType<typeof createNeonAuth> {
  if (!authInstance) {
    authInstance = createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL || "https://auth.neon.tech/unconfigured",
      cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET || DUMMY_SECRET,
        sessionDataTtl: 300,
      },
    });
  }
  return authInstance;
}

export const auth = new Proxy({} as ReturnType<typeof createNeonAuth>, {
  get(_target, prop) {
    const instance = getAuth();
    const val = (instance as unknown as Record<string, unknown>)[prop as string];
    if (typeof val === "function") {
      return val.bind(instance);
    }
    return val;
  },
});

/**
 * Safely retrieves the authenticated user session on the server.
 * Returns null if unauthenticated or if Neon Auth is not yet configured.
 */
export async function getServerSession(): Promise<UserSession | null> {
  if (!isNeonAuthConfigured()) {
    return null;
  }
  try {
    const res = await auth.getSession();
    if (res?.data?.user) {
      return res.data as unknown as UserSession;
    }
    return null;
  } catch (err) {
    const isPrerenderSignal =
      err &&
      typeof err === "object" &&
      ("digest" in err || (err instanceof Error && err.message.includes("prerender")));
    if (!isPrerenderSignal) {
      console.error("Failed to retrieve server auth session:", err);
    }
    return null;
  }
}
