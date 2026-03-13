import { NextResponse } from "next/server";

import { getRequestScope, assertOwnerAccess } from "@/lib/controlplane/scope";
import { getShareStore } from "@/lib/controlplane/share-store-accessor";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ tokenId: string }> }
) {
  const scope = getRequestScope(request);
  const ownerError = assertOwnerAccess(scope);
  if (ownerError) return ownerError;

  const store = getShareStore();
  if (!store) {
    return NextResponse.json({ error: "Share store not available." }, { status: 503 });
  }

  const { tokenId } = await context.params;
  const normalizedId = (tokenId ?? "").trim();
  if (!normalizedId) {
    return NextResponse.json({ error: "tokenId is required." }, { status: 400 });
  }

  const share = store.getShareToken(normalizedId);
  if (!share) {
    return NextResponse.json({ error: "Share token not found." }, { status: 404 });
  }

  // Redact the actual token value
  const { token, ...rest } = share;
  return NextResponse.json({
    ok: true,
    share: { ...rest, tokenPreview: token.slice(0, 8) + "..." },
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ tokenId: string }> }
) {
  const scope = getRequestScope(request);
  const ownerError = assertOwnerAccess(scope);
  if (ownerError) return ownerError;

  const store = getShareStore();
  if (!store) {
    return NextResponse.json({ error: "Share store not available." }, { status: 503 });
  }

  const { tokenId } = await context.params;
  const normalizedId = (tokenId ?? "").trim();
  if (!normalizedId) {
    return NextResponse.json({ error: "tokenId is required." }, { status: 400 });
  }

  const revoked = store.revokeShareToken(normalizedId);
  if (!revoked) {
    return NextResponse.json({ error: "Share token not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
