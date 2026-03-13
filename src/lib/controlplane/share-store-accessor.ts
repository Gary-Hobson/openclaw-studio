export type ShareToken = {
  id: string;
  token: string;
  agentId: string;
  permissions: string[];
  label: string | null;
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
};

export type ShareStore = {
  createShareToken: (params: {
    agentId: string;
    permissions?: string[];
    label?: string;
    expiresAt?: string;
  }) => ShareToken;
  validateShareToken: (token: string) => ShareToken | null;
  getShareToken: (id: string) => ShareToken | null;
  listShareTokens: (agentId?: string) => ShareToken[];
  revokeShareToken: (id: string) => boolean;
  close: () => void;
};

type GlobalShareStoreState = typeof globalThis & {
  __openclawStudioShareStore?: ShareStore;
};

export function getShareStore(): ShareStore | null {
  const globalState = globalThis as GlobalShareStoreState;
  return globalState.__openclawStudioShareStore ?? null;
}

export function requireShareStore(): ShareStore {
  const store = getShareStore();
  if (!store) {
    throw new Error(
      "Share store is not available. Ensure server/index.js initializes the share store."
    );
  }
  return store;
}
