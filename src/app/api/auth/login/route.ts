import { NextResponse } from "next/server";

import { getShareStore } from "@/lib/controlplane/share-store-accessor";

export const runtime = "nodejs";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

/**
 * POST /api/auth/login
 *
 * Accepts a `token` in the body and determines what kind of access it grants:
 * - If it matches STUDIO_ACCESS_TOKEN → set owner cookie, return { role: "owner" }
 * - If it matches a valid share token → set share cookie, return { role: "shared", agentId, permissions }
 * - Otherwise → 401
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }

  // Check admin token
  const adminToken = (process.env.STUDIO_ACCESS_TOKEN ?? "").trim();
  if (adminToken && token === adminToken) {
    const response = NextResponse.json({ ok: true, role: "owner" });
    response.cookies.set("studio_access", adminToken, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    // Clear any share cookie
    response.cookies.set("studio_share", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  // Check share token
  const shareStore = getShareStore();
  if (shareStore) {
    const validated = shareStore.validateShareToken(token);
    if (validated) {
      const response = NextResponse.json({
        ok: true,
        role: "shared",
        agentId: validated.agentId,
        permissions: validated.permissions,
      });
      response.cookies.set("studio_share", validated.token, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        maxAge: 31536000,
      });
      // Clear any owner cookie
      response.cookies.set("studio_access", "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
      });
      return response;
    }
  }

  return NextResponse.json(
    { error: "Invalid token. Please check and try again." },
    { status: 401 }
  );
}
