import { NextResponse } from "next/server";

import { executeRuntimeGatewayRead } from "@/lib/controlplane/runtime-read-route";
import { getRequestScope } from "@/lib/controlplane/scope";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const scope = getRequestScope(request);

  // Shared users get an empty config snapshot (they don't need gateway config)
  if (scope.role !== "owner") {
    return NextResponse.json({ ok: true, payload: {} });
  }

  return await executeRuntimeGatewayRead("config.get", {});
}
