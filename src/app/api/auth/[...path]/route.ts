import { auth, isNeonAuthConfigured } from "@/lib/auth-server";
import { NextResponse } from "next/server";

const handlers = auth.handler();

async function proxyAuthRequest(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  if (!isNeonAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Neon Auth is not configured. Please define NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET in .env.local.",
      },
      { status: 503 }
    );
  }

  // Neon Auth upstream Better Auth verifies that the incoming Origin is in its allowed origins list.
  // Because ngrok domains, local IP addresses, and mobile devices differ from the fixed dashboard URL,
  // we proxy upstream with http://localhost:3000 (which Neon Auth accepts by default), and then
  // route cookies and redirects back to the client's actual origin.
  const rawOrigin = request.headers.get("origin");
  const rawReferer = request.headers.get("referer");
  let clientOrigin = rawOrigin || "";
  if (!clientOrigin && rawReferer) {
    try {
      clientOrigin = new URL(rawReferer).origin;
    } catch {
      clientOrigin = "";
    }
  }

  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.set("origin", "http://localhost:3000");
  if (upstreamHeaders.has("referer")) {
    upstreamHeaders.set("referer", "http://localhost:3000/");
  }

  let body: string | undefined;
  if (method !== "GET") {
    try {
      body = await request.text();
    } catch {
      // body already read or empty
    }
  }

  const proxiedRequest = new Request(request.url, {
    method,
    headers: upstreamHeaders,
    body: body !== undefined && body.length > 0 ? body : undefined,
  });

  const response = await handlers[method](proxiedRequest, context);

  // If upstream responded with a redirect to localhost:3000, rewrite to clientOrigin if present
  if (clientOrigin && clientOrigin !== "http://localhost:3000" && response.headers.has("location")) {
    const loc = response.headers.get("location")!;
    if (loc.startsWith("http://localhost:3000")) {
      const rewrittenLoc = loc.replace("http://localhost:3000", clientOrigin);
      const newHeaders = new Headers(response.headers);
      newHeaders.set("location", rewrittenLoc);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }
  }

  return response;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyAuthRequest("GET", request, context);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyAuthRequest("POST", request, context);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyAuthRequest("PUT", request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyAuthRequest("DELETE", request, context);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyAuthRequest("PATCH", request, context);
}
