import { NextResponse } from "next/server";

import { getShareStore } from "@/lib/controlplane/share-store-accessor";

export const runtime = "nodejs";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export async function POST(request: Request) {
  const store = getShareStore();
  if (!store) {
    return NextResponse.json({ error: "Share store not available." }, { status: 503 });
  }

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
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }

  const validated = store.validateShareToken(token);
  if (!validated) {
    return NextResponse.json({ error: "Invalid or expired share token." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    agentId: validated.agentId,
    permissions: validated.permissions,
  });
}
