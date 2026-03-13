import { executeRuntimeGatewayRead } from "@/lib/controlplane/runtime-read-route";
import { getRequestScope, assertOwnerAccess } from "@/lib/controlplane/scope";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const scope = getRequestScope(request);
  const ownerError = assertOwnerAccess(scope);
  if (ownerError) return ownerError;

  const url = new URL(request.url);
  const includeDisabled = (url.searchParams.get("includeDisabled") ?? "true").trim();
  return await executeRuntimeGatewayRead("cron.list", {
    includeDisabled: includeDisabled !== "false",
  });
}
