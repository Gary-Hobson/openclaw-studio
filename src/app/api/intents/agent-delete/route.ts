import { NextResponse } from "next/server";

import { executeGatewayIntent, parseIntentBody } from "@/lib/controlplane/intent-route";
import { getRequestScope, assertOwnerAccess } from "@/lib/controlplane/scope";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const scope = getRequestScope(request);
  const ownerError = assertOwnerAccess(scope);
  if (ownerError) return ownerError;

  const bodyOrError = await parseIntentBody(request);
  if (bodyOrError instanceof Response) {
    return bodyOrError as NextResponse;
  }
  const agentId = typeof bodyOrError.agentId === "string" ? bodyOrError.agentId.trim() : "";
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required." }, { status: 400 });
  }
  return await executeGatewayIntent("agents.delete", { agentId });
}
