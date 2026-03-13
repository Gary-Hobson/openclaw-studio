import {
  parseIntentBody,
  executeGatewayIntent,
  LONG_RUNNING_GATEWAY_INTENT_TIMEOUT_MS,
} from "@/lib/controlplane/intent-route";
import { getRequestScope, assertAgentAccess, extractAgentIdFromSessionKey } from "@/lib/controlplane/scope";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseIntentBody(request);
  if (parsed instanceof Response) return parsed;

  const runId = typeof parsed.runId === "string" ? parsed.runId.trim() : "";
  if (!runId) {
    return Response.json({ error: "runId is required." }, { status: 400 });
  }

  // agent-wait doesn't have a sessionKey in the body, allow through
  // (the runId is opaque and hard to scope without a lookup)

  const timeoutMs =
    typeof parsed.timeoutMs === "number" && Number.isFinite(parsed.timeoutMs)
      ? Math.max(1, Math.floor(parsed.timeoutMs))
      : undefined;

  return executeGatewayIntent("agent.wait", {
    runId,
    ...(typeof timeoutMs === "number" ? { timeoutMs } : {}),
  }, {
    timeoutMs: typeof timeoutMs === "number" ? timeoutMs : LONG_RUNNING_GATEWAY_INTENT_TIMEOUT_MS,
  });
}
