import { NextResponse } from "next/server";

import { executeGatewayIntent, parseIntentBody } from "@/lib/controlplane/intent-route";
import { getRequestScope, assertAgentAccess, extractAgentIdFromSessionKey } from "@/lib/controlplane/scope";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const bodyOrError = await parseIntentBody(request);
  if (bodyOrError instanceof Response) {
    return bodyOrError as NextResponse;
  }
  const sessionKey = typeof bodyOrError.sessionKey === "string" ? bodyOrError.sessionKey.trim() : "";
  if (!sessionKey) {
    return NextResponse.json({ error: "sessionKey is required." }, { status: 400 });
  }

  const scope = getRequestScope(request);
  const agentId = extractAgentIdFromSessionKey(sessionKey);
  if (agentId) {
    const accessError = assertAgentAccess(scope, agentId);
    if (accessError) return accessError;
  }

  const runId = typeof bodyOrError.runId === "string" ? bodyOrError.runId.trim() : "";
  return await executeGatewayIntent("chat.abort", runId ? { sessionKey, runId } : { sessionKey });
}
