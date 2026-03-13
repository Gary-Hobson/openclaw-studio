export type ShareTokenSummary = {
  id: string;
  token: string;
  agentId: string;
  permissions: string[];
  label: string | null;
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
  tokenPreview: string;
};

export type CreatedShareToken = {
  id: string;
  token: string;
  agentId: string;
  permissions: string[];
  label: string | null;
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
};

export async function listShares(agentId: string): Promise<ShareTokenSummary[]> {
  const params = new URLSearchParams();
  if (agentId) params.set("agentId", agentId);
  const response = await fetch(`/api/shares?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to list shares.");
  }
  const data = (await response.json()) as { shares?: ShareTokenSummary[] };
  return data.shares ?? [];
}

export async function createShare(params: {
  agentId: string;
  permissions?: string[];
  label?: string;
  expiresAt?: string;
}): Promise<CreatedShareToken> {
  const response = await fetch("/api/shares", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "Failed to create share.");
  }
  const data = (await response.json()) as { share: CreatedShareToken };
  return data.share;
}

export async function revokeShare(tokenId: string): Promise<void> {
  const response = await fetch(`/api/shares/${encodeURIComponent(tokenId)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "Failed to revoke share.");
  }
}

export async function validateShareToken(
  token: string
): Promise<{ agentId: string; permissions: string[] } | null> {
  const response = await fetch("/api/shares/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    ok: boolean;
    agentId: string;
    permissions: string[];
  };
  if (!data.ok) return null;
  return { agentId: data.agentId, permissions: data.permissions };
}
