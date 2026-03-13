import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** POST /api/auth/logout — clear all auth cookies and redirect to /login */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("studio_access", "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set("studio_share", "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
