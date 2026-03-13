import { NextResponse } from "next/server";

import { executeGatewayIntent, parseIntentBody } from "@/lib/controlplane/intent-route";
import { getRequestScope, assertAgentAccess, extractAgentIdFromSessionKey } from "@/lib/controlplane/scope";

export const runtime = "nodejs";

const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

export async function POST(request: Request) {
  const bodyOrError = await parseIntentBody(request);
  if (bodyOrError instanceof Response) {
    return bodyOrError as NextResponse;
  }

  const sessionKey =
    typeof bodyOrError.sessionKey === "string" ? bodyOrError.sessionKey.trim() : "";
  if (!sessionKey) {
    return NextResponse.json({ error: "sessionKey is required." }, { status: 400 });
  }

  const scope = getRequestScope(request);
  const agentId = extractAgentIdFromSessionKey(sessionKey);
  if (agentId) {
    const accessError = assertAgentAccess(scope, agentId);
    if (accessError) return accessError;
  }

  const includeModel = hasOwn(bodyOrError, "model");
  const includeThinkingLevel = hasOwn(bodyOrError, "thinkingLevel");
  const includeExecHost = hasOwn(bodyOrError, "execHost");
  const includeExecSecurity = hasOwn(bodyOrError, "execSecurity");
  const includeExecAsk = hasOwn(bodyOrError, "execAsk");
  if (
    !includeModel &&
    !includeThinkingLevel &&
    !includeExecHost &&
    !includeExecSecurity &&
    !includeExecAsk
  ) {
    return NextResponse.json(
      { error: "At least one session setting field is required." },
      { status: 400 }
    );
  }

  return await executeGatewayIntent("sessions.patch", {
    key: sessionKey,
    ...(includeModel ? { model: bodyOrError.model ?? null } : {}),
    ...(includeThinkingLevel ? { thinkingLevel: bodyOrError.thinkingLevel ?? null } : {}),
    ...(includeExecHost ? { execHost: bodyOrError.execHost ?? null } : {}),
    ...(includeExecSecurity ? { execSecurity: bodyOrError.execSecurity ?? null } : {}),
    ...(includeExecAsk ? { execAsk: bodyOrError.execAsk ?? null } : {}),
  });
}
