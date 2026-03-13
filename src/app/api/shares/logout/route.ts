import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/shares/logout
 * Clears the studio_share cookie and redirects to /.
 * This allows a shared user to exit shared mode.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("studio_share", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET() {
  const response = NextResponse.redirect(new URL("/", "http://localhost"), {
    status: 302,
  });
  response.cookies.set("studio_share", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
