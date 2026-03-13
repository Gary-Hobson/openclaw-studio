import { NextResponse } from "next/server";

import { executeRuntimeGatewayRead } from "@/lib/controlplane/runtime-read-route";
import { getRequestScope, assertAgentAccess } from "@/lib/controlplane/scope";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agentId = (url.searchParams.get("agentId") ?? "").trim();
  const name = (url.searchParams.get("name") ?? "").trim();
  if (!agentId || !name) {
    return NextResponse.json({ error: "agentId and name are required." }, { status: 400 });
  }

  const scope = getRequestScope(request);
  const accessError = assertAgentAccess(scope, agentId);
  if (accessError) return accessError;

  return await executeRuntimeGatewayRead("agents.files.get", {
    agentId,
    name,
  });
}
