import { NextResponse } from "next/server";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";

import { getRequestScope, assertAgentAccess } from "@/lib/controlplane/scope";
import { isLocalGatewayUrl } from "@/lib/gateway/local-gateway";
import { loadStudioSettings } from "@/lib/studio/settings-store";
import {
  resolveConfiguredSshTarget,
  resolveGatewaySshTargetFromGatewayUrl,
} from "@/lib/ssh/gateway-host";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const SAFE_FILENAME_RE = /^[a-zA-Z0-9._-]+$/;

const sanitizeFilename = (name: string): string => {
  const basename = path.basename(name).trim();
  if (!basename) return `upload-${Date.now()}`;
  if (SAFE_FILENAME_RE.test(basename)) return basename;
  // Replace unsafe chars but keep extension
  const ext = path.extname(basename);
  const stem = path.basename(basename, ext).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${stem || "file"}${ext}`;
};

const resolveUploadDir = (agentId: string): string => {
  const home = os.homedir();
  return path.join(home, ".openclaw", "uploads", agentId);
};

const resolveSshTarget = (): string | null => {
  const settings = loadStudioSettings();
  const gatewayUrl = settings.gateway?.url ?? "";
  if (isLocalGatewayUrl(gatewayUrl)) return null;
  const configured = resolveConfiguredSshTarget(process.env);
  if (configured) return configured;
  return resolveGatewaySshTargetFromGatewayUrl(gatewayUrl, process.env);
};

/**
 * POST /api/runtime/upload
 *
 * Accepts multipart/form-data with:
 * - file: the uploaded file
 * - agentId: target agent ID
 *
 * Saves to ~/.openclaw/uploads/{agentId}/{timestamp}-{filename}
 * Returns { path, filename, size, mimeType }
 */
export async function POST(request: Request) {
  const scope = getRequestScope(request);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  const agentId = (formData.get("agentId") as string)?.trim() ?? "";

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required." }, { status: 400 });
  }

  const accessError = assertAgentAccess(scope, agentId);
  if (accessError) return accessError;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
      { status: 400 }
    );
  }

  const sshTarget = resolveSshTarget();
  if (sshTarget) {
    // Remote upload not yet supported — would need SSH file transfer
    return NextResponse.json(
      { error: "File upload to remote gateways is not yet supported." },
      { status: 501 }
    );
  }

  try {
    const uploadDir = resolveUploadDir(agentId);
    await fs.mkdir(uploadDir, { recursive: true });

    const uniqueId = crypto.randomBytes(4).toString("hex");
    const safeName = sanitizeFilename(file.name);
    const destFilename = `${Date.now()}-${uniqueId}-${safeName}`;
    const destPath = path.join(uploadDir, destFilename);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(destPath, Buffer.from(arrayBuffer));

    return NextResponse.json({
      ok: true,
      path: destPath,
      filename: safeName,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
