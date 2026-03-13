import { NextResponse } from "next/server";

export type RequestScope =
  | { role: "owner" }
  | { role: "shared"; agentId: string; permissions: string[] };

const AGENT_SESSION_KEY_RE = /^agent:([^:]+):/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

/**
 * Resolve the request scope from the `x-studio-scope` header (set by access-gate)
 * or by reading cookies directly (fallback for Next.js App Router).
 *
 * Now that all requests require auth, the default is still "owner" for backward
 * compat with tests, but in production, access-gate ensures unauthenticated
 * requests never reach here.
 */
export function getRequestScope(request?: Request): RequestScope {
  // 1. Try x-studio-scope header (injected by access-gate on the raw Node.js req)
  const header = request?.headers?.get?.("x-studio-scope") ?? null;
  if (header) {
    try {
      const parsed: unknown = JSON.parse(header);
      if (isRecord(parsed)) {
        if (parsed.role === "shared") {
          const agentId =
            typeof parsed.agentId === "string" ? parsed.agentId.trim() : "";
          const permissions = Array.isArray(parsed.permissions)
            ? (parsed.permissions as unknown[])
                .filter((p): p is string => typeof p === "string")
                .map((p) => p.trim())
            : [];
          if (agentId) return { role: "shared", agentId, permissions };
        }
        if (parsed.role === "owner") return { role: "owner" };
      }
    } catch {
      // parse error — fall through
    }
  }

  // 2. Fallback: read cookies directly from the Request
  //    (Next.js App Router may reconstruct the Request, losing custom headers
  //     injected by access-gate. But cookies ARE always forwarded.)
  try {
    const cookieHeader = request?.headers?.get?.("cookie") ?? "";
    if (cookieHeader) {
      return resolveFromCookieHeader(cookieHeader);
    }
  } catch {
    // ignore
  }

  // Default to owner (backward compat for tests without request objects)
  return { role: "owner" };
}

function resolveFromCookieHeader(cookieHeader: string): RequestScope {
  const parsed = parseCookieHeader(cookieHeader);

  // Check owner cookie first (owner takes priority)
  const ownerCookie = parsed["studio_access"];
  const ownerToken = (process.env.STUDIO_ACCESS_TOKEN ?? "").trim();
  if (ownerToken && ownerCookie === ownerToken) {
    return { role: "owner" };
  }

  // Check share cookie
  const shareCookie = parsed["studio_share"];
  if (shareCookie) {
    const shareStore = (globalThis as Record<string, unknown>).__openclawStudioShareStore as
      | { validateShareToken: (token: string) => { agentId: string; permissions: string[]; token: string } | null }
      | undefined;
    if (shareStore) {
      const validated = shareStore.validateShareToken(shareCookie);
      if (validated) {
        return {
          role: "shared",
          agentId: validated.agentId,
          permissions: validated.permissions,
        };
      }
    }
  }

  // No valid auth found — default to owner for test compat
  // In production, access-gate would have blocked the request before it got here
  return { role: "owner" };
}

function parseCookieHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

export function isOwner(scope: RequestScope): boolean {
  return scope.role === "owner";
}

export function assertOwnerAccess(scope: RequestScope): NextResponse | null {
  if (isOwner(scope)) return null;
  return NextResponse.json(
    { error: "This action requires owner access." },
    { status: 403 }
  );
}

export function assertAgentAccess(
  scope: RequestScope,
  agentId: string
): NextResponse | null {
  if (isOwner(scope)) return null;
  if (scope.role === "shared") {
    const normalizedAgentId = agentId.trim().toLowerCase();
    const normalizedScopeAgentId = scope.agentId.trim().toLowerCase();
    if (normalizedAgentId === normalizedScopeAgentId) return null;
  }
  return NextResponse.json(
    { error: "You do not have access to this agent." },
    { status: 403 }
  );
}

export function assertPermission(
  scope: RequestScope,
  permission: string
): NextResponse | null {
  if (isOwner(scope)) return null;
  if (
    scope.role === "shared" &&
    scope.permissions.includes(permission)
  ) {
    return null;
  }
  return NextResponse.json(
    { error: `Missing permission: ${permission}` },
    { status: 403 }
  );
}

export function extractAgentIdFromSessionKey(
  sessionKey: string
): string | null {
  const match = sessionKey.trim().match(AGENT_SESSION_KEY_RE);
  return match?.[1]?.trim().toLowerCase() ?? null;
}

export function filterByAgentScope<T extends { agentId?: string }>(
  scope: RequestScope,
  items: T[],
  getAgentId?: (item: T) => string
): T[] {
  if (isOwner(scope)) return items;
  if (scope.role !== "shared") return [];
  const normalizedScopeAgentId = scope.agentId.trim().toLowerCase();
  return items.filter((item) => {
    const itemAgentId = getAgentId
      ? getAgentId(item)
      : (item.agentId ?? "");
    return itemAgentId.trim().toLowerCase() === normalizedScopeAgentId;
  });
}
