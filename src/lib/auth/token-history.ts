// Shared token history helpers for localStorage persistence.
// Used by login page and shared entry page.

export type SavedToken = {
  token: string;
  name: string;
  role: "owner" | "shared";
  agentId?: string;
  lastUsed: number;
};

const STORAGE_KEY = "openclaw_token_history";

export const loadTokenHistory = (): SavedToken[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveTokenHistory = (tokens: SavedToken[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {}
};

export const upsertToken = (
  token: string,
  role: "owner" | "shared",
  agentId?: string,
  existingName?: string
): SavedToken[] => {
  const history = loadTokenHistory();
  const existing = history.find((t) => t.token === token);
  if (existing) {
    existing.role = role;
    existing.agentId = agentId;
    existing.lastUsed = Date.now();
    return [...history];
  }
  const masked =
    token.length > 8
      ? `${token.slice(0, 4)}...${token.slice(-4)}`
      : "****";
  const defaultName =
    role === "owner"
      ? "Admin"
      : agentId
        ? `Share (${agentId})`
        : `Token ${masked}`;
  return [
    ...history,
    {
      token,
      name: existingName ?? defaultName,
      role,
      agentId,
      lastUsed: Date.now(),
    },
  ];
};

export const renameToken = (token: string, newName: string): SavedToken[] => {
  const history = loadTokenHistory();
  const entry = history.find((t) => t.token === token);
  if (entry) {
    entry.name = newName.trim() || entry.name;
  }
  return [...history];
};

export const removeToken = (token: string): SavedToken[] => {
  return loadTokenHistory().filter((t) => t.token !== token);
};

export const maskToken = (token: string): string => {
  if (token.length <= 8) return "••••••••";
  return `${token.slice(0, 4)}${"•".repeat(Math.min(8, token.length - 8))}${token.slice(-4)}`;
};
