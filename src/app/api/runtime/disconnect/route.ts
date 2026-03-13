import { NextResponse } from "next/server";

import { deriveRuntimeFreshness } from "@/lib/controlplane/degraded-read";
import { peekControlPlaneRuntime } from "@/lib/controlplane/runtime";
import { applyStudioSettingsPatch } from "@/lib/studio/settings-store";
import { getRequestScope, assertOwnerAccess } from "@/lib/controlplane/scope";

export const runtime = "nodejs";

export async function POST(request?: Request) {
  if (request) {
    const scope = getRequestScope(request);
    const ownerError = assertOwnerAccess(scope);
    if (ownerError) return ownerError;
  }

  try {
    applyStudioSettingsPatch({ gatewayAutoStart: false });
    const controlPlane = peekControlPlaneRuntime();
    if (!controlPlane) {
      const summary = {
        status: "stopped" as const,
        reason: null,
        asOf: null,
        outboxHead: 0,
      };
      return NextResponse.json({
        enabled: true,
        summary,
        freshness: deriveRuntimeFreshness(summary, null),
      });
    }

    await controlPlane.disconnect();
    const summary = controlPlane.snapshot();
    return NextResponse.json({
      enabled: true,
      summary,
      freshness: deriveRuntimeFreshness(summary, null),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disconnect Studio runtime.";
    return NextResponse.json({ enabled: true, error: message }, { status: 500 });
  }
}
