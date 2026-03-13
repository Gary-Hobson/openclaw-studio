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
  const message = typeof bodyOrError.message === "string" ? bodyOrError.message : "";
  const idempotencyKey =
    typeof bodyOrError.idempotencyKey === "string" ? bodyOrError.idempotencyKey.trim() : "";
  const deliver = Boolean(bodyOrError.deliver);

  if (!sessionKey || !message.trim() || !idempotencyKey) {
    return NextResponse.json(
      { error: "sessionKey, message, and idempotencyKey are required." },
      { status: 400 }
    );
  }

  const scope = getRequestScope(request);
  const agentId = extractAgentIdFromSessionKey(sessionKey);
  if (agentId) {
    const accessError = assertAgentAccess(scope, agentId);
    if (accessError) return accessError;
  }

  return await executeGatewayIntent("chat.send", {
    sessionKey,
    message,
    idempotencyKey,
    deliver,
  });
}
