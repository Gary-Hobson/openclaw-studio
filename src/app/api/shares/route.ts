import { NextResponse } from "next/server";

import { getRequestScope, assertOwnerAccess, isOwner } from "@/lib/controlplane/scope";
import { getShareStore } from "@/lib/controlplane/share-store-accessor";

export const runtime = "nodejs";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const enrichToken = (share: Record<string, unknown>) => {
  const token = typeof share.token === "string" ? share.token : "";
  return {
    ...share,
    tokenPreview: token ? token.slice(0, 8) + "..." : "",
  };
};

export async function GET(request: Request) {
  const scope = getRequestScope(request);
  const ownerError = assertOwnerAccess(scope);
  if (ownerError) return ownerError;

  const store = getShareStore();
  if (!store) {
    return NextResponse.json({ error: "Share store not available." }, { status: 503 });
  }

  const url = new URL(request.url);
  const agentId = (url.searchParams.get("agentId") ?? "").trim();
  const shares = store.listShareTokens(agentId || undefined);

  return NextResponse.json({
    ok: true,
    shares: shares.map((s) => enrichToken(s as unknown as Record<string, unknown>)),
  });
}

export async function POST(request: Request) {
  const scope = getRequestScope(request);
  const ownerError = assertOwnerAccess(scope);
  if (ownerError) return ownerError;

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

  const agentId = typeof body.agentId === "string" ? body.agentId.trim() : "";
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required." }, { status: 400 });
  }

  const permissions = Array.isArray(body.permissions)
    ? body.permissions.filter((p): p is string => typeof p === "string")
    : ["chat", "settings"];
  const label = typeof body.label === "string" ? body.label.trim() : undefined;
  const expiresAt = typeof body.expiresAt === "string" ? body.expiresAt.trim() : undefined;

  try {
    const share = store.createShareToken({ agentId, permissions, label, expiresAt });
    return NextResponse.json({ ok: true, share });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create share token.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
