import { executeRuntimeGatewayRead } from "@/lib/controlplane/runtime-read-route";

export const runtime = "nodejs";

// Models list is read-only and needed for chat — allow all authenticated users
export async function GET() {
  return await executeRuntimeGatewayRead("models.list", {});
}
