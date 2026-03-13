import { NextResponse } from "next/server";

import { executeGatewayIntent, parseIntentBody } from "@/lib/controlplane/intent-route";
import { getRequestScope, assertAgentAccess } from "@/lib/controlplane/scope";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const bodyOrError = await parseIntentBody(request);
  if (bodyOrError instanceof Response) {
    return bodyOrError as NextResponse;
  }
  const agentId = typeof bodyOrError.agentId === "string" ? bodyOrError.agentId.trim() : "";
  const name = typeof bodyOrError.name === "string" ? bodyOrError.name.trim() : "";
  if (!agentId || !name) {
    return NextResponse.json({ error: "agentId and name are required." }, { status: 400 });
  }

  const scope = getRequestScope(request);
  const accessError = assertAgentAccess(scope, agentId);
  if (accessError) return accessError;

  return await executeGatewayIntent("agents.update", { agentId, name });
}
