import { GatewayResponseError, type GatewayClient } from "@/lib/gateway/GatewayClient";
import type {
  ProjectTileHeartbeat,
  ProjectTileHeartbeatResult,
  ProjectTileHeartbeatUpdatePayload,
} from "@/lib/projects/types";

export type GatewayConfigSnapshot = {
  config?: Record<string, unknown>;
  hash?: string;
  exists?: boolean;
};

type AgentEntry = Record<string, unknown> & { id: string };

type HeartbeatBlock = Record<string, unknown> | null | undefined;

const DEFAULT_EVERY = "30m";
const DEFAULT_TARGET = "last";
const DEFAULT_ACK_MAX_CHARS = 300;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const coerceString = (value: unknown) => (typeof value === "string" ? value : undefined);
const coerceBoolean = (value: unknown) =>
  typeof value === "boolean" ? value : undefined;
const coerceNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const coerceActiveHours = (value: unknown) => {
  if (!isRecord(value)) return undefined;
  const start = coerceString(value.start);
  const end = coerceString(value.end);
  if (!start || !end) return undefined;
  return { start, end };
};

const readAgentList = (config: Record<string, unknown> | undefined): AgentEntry[] => {
  if (!config) return [];
  const agents = isRecord(config.agents) ? config.agents : null;
  const list = Array.isArray(agents?.list) ? agents?.list : [];
  return list.filter(
    (entry): entry is AgentEntry => isRecord(entry) && typeof entry.id === "string"
  );
};

const writeAgentList = (config: Record<string, unknown>, list: AgentEntry[]) => {
  const agents = isRecord(config.agents) ? { ...config.agents } : {};
  return { ...config, agents: { ...agents, list } };
};

const upsertAgentEntry = (
  list: AgentEntry[],
  agentId: string,
  updater: (entry: AgentEntry) => AgentEntry
) => {
  let updatedEntry: AgentEntry | null = null;
  const nextList = list.map((entry) => {
    if (entry.id !== agentId) return entry;
    const next = updater({ ...entry, id: agentId });
    updatedEntry = next;
    return next;
  });
  if (!updatedEntry) {
    updatedEntry = updater({ id: agentId });
    nextList.push(updatedEntry);
  }
  return { list: nextList, entry: updatedEntry };
};

const mergeHeartbeat = (defaults: HeartbeatBlock, override: HeartbeatBlock) => {
  const merged = {
    ...(defaults ?? {}),
    ...(override ?? {}),
  } as Record<string, unknown>;
  if (override && typeof override === "object" && "activeHours" in override) {
    merged.activeHours = (override as Record<string, unknown>).activeHours;
  } else if (defaults && typeof defaults === "object" && "activeHours" in defaults) {
    merged.activeHours = (defaults as Record<string, unknown>).activeHours;
  }
  return merged;
};

const normalizeHeartbeat = (
  defaults: HeartbeatBlock,
  override: HeartbeatBlock
): ProjectTileHeartbeatResult => {
  const resolved = mergeHeartbeat(defaults, override);
  const every = coerceString(resolved.every) ?? DEFAULT_EVERY;
  const target = coerceString(resolved.target) ?? DEFAULT_TARGET;
  const includeReasoning = coerceBoolean(resolved.includeReasoning) ?? false;
  const ackMaxChars = coerceNumber(resolved.ackMaxChars) ?? DEFAULT_ACK_MAX_CHARS;
  const activeHours = coerceActiveHours(resolved.activeHours) ?? null;
  return {
    heartbeat: {
      every,
      target,
      includeReasoning,
      ackMaxChars,
      activeHours,
    },
    hasOverride: Boolean(override && typeof override === "object"),
  };
};

const readHeartbeatDefaults = (config: Record<string, unknown>): HeartbeatBlock => {
  const agents = isRecord(config.agents) ? config.agents : null;
  const defaults = agents && isRecord(agents.defaults) ? agents.defaults : null;
  return (defaults?.heartbeat ?? null) as HeartbeatBlock;
};

const buildHeartbeatOverride = (payload: ProjectTileHeartbeat): Record<string, unknown> => {
  const nextHeartbeat: Record<string, unknown> = {
    every: payload.every,
    target: payload.target,
    includeReasoning: payload.includeReasoning,
  };
  if (payload.ackMaxChars !== undefined && payload.ackMaxChars !== null) {
    nextHeartbeat.ackMaxChars = payload.ackMaxChars;
  }
  if (payload.activeHours) {
    nextHeartbeat.activeHours = {
      start: payload.activeHours.start,
      end: payload.activeHours.end,
    };
  }
  return nextHeartbeat;
};

export const resolveHeartbeatSettings = (
  config: Record<string, unknown>,
  agentId: string
): ProjectTileHeartbeatResult => {
  const list = readAgentList(config);
  const entry = list.find((item) => item.id === agentId) ?? null;
  const defaults = readHeartbeatDefaults(config);
  const override =
    entry && typeof entry === "object"
      ? ((entry as Record<string, unknown>).heartbeat as HeartbeatBlock)
      : null;
  return normalizeHeartbeat(defaults, override);
};

const shouldRetryConfigPatch = (err: unknown) => {
  if (!(err instanceof GatewayResponseError)) return false;
  return /re-run config\.get|config changed since last load/i.test(err.message);
};

const applyGatewayConfigPatch = async (params: {
  client: GatewayClient;
  patch: Record<string, unknown>;
  baseHash?: string | null;
  exists?: boolean;
  sessionKey?: string;
  attempt?: number;
}): Promise<void> => {
  const attempt = params.attempt ?? 0;
  const requiresBaseHash = params.exists !== false;
  const baseHash = requiresBaseHash ? params.baseHash?.trim() : undefined;
  if (requiresBaseHash && !baseHash) {
    throw new Error("Gateway config hash unavailable; re-run config.get.");
  }
  const payload: Record<string, unknown> = {
    raw: JSON.stringify(params.patch, null, 2),
  };
  if (baseHash) payload.baseHash = baseHash;
  if (params.sessionKey) payload.sessionKey = params.sessionKey;
  try {
    await params.client.call("config.patch", payload);
  } catch (err) {
    if (attempt < 1 && shouldRetryConfigPatch(err)) {
      const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
      return applyGatewayConfigPatch({
        ...params,
        baseHash: snapshot.hash ?? undefined,
        exists: snapshot.exists,
        attempt: attempt + 1,
      });
    }
    throw err;
  }
};

export const renameGatewayAgent = async (params: {
  client: GatewayClient;
  agentId: string;
  name: string;
  sessionKey?: string;
}) => {
  const trimmed = params.name.trim();
  if (!trimmed) {
    throw new Error("Agent name is required.");
  }
  const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
  const baseConfig = isRecord(snapshot.config) ? snapshot.config : {};
  const list = readAgentList(baseConfig);
  const { list: nextList, entry } = upsertAgentEntry(list, params.agentId, (entry) => ({
    ...entry,
    name: trimmed,
  }));
  const patch = { agents: { list: nextList } };
  await applyGatewayConfigPatch({
    client: params.client,
    patch,
    baseHash: snapshot.hash ?? undefined,
    exists: snapshot.exists,
    sessionKey: params.sessionKey,
  });
  return entry;
};

export const deleteGatewayAgent = async (params: {
  client: GatewayClient;
  agentId: string;
  sessionKey?: string;
}) => {
  const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
  const baseConfig = isRecord(snapshot.config) ? snapshot.config : {};
  const list = readAgentList(baseConfig);
  const nextList = list.filter((entry) => entry.id !== params.agentId);
  const bindings = Array.isArray(baseConfig.bindings) ? baseConfig.bindings : [];
  const nextBindings = bindings.filter((binding) => {
    if (!binding || typeof binding !== "object") return true;
    const agentId = (binding as Record<string, unknown>).agentId;
    return agentId !== params.agentId;
  });
  const patch: Record<string, unknown> = {};
  if (nextList.length !== list.length) {
    patch.agents = { list: nextList };
  }
  if (nextBindings.length !== bindings.length) {
    patch.bindings = nextBindings;
  }
  if (Object.keys(patch).length === 0) {
    return { removed: false, removedBindings: 0 };
  }
  await applyGatewayConfigPatch({
    client: params.client,
    patch,
    baseHash: snapshot.hash ?? undefined,
    exists: snapshot.exists,
    sessionKey: params.sessionKey,
  });
  return {
    removed: nextList.length !== list.length,
    removedBindings: bindings.length - nextBindings.length,
  };
};

export const updateGatewayHeartbeat = async (params: {
  client: GatewayClient;
  agentId: string;
  payload: ProjectTileHeartbeatUpdatePayload;
  sessionKey?: string;
}): Promise<ProjectTileHeartbeatResult> => {
  const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
  const baseConfig = isRecord(snapshot.config) ? snapshot.config : {};
  const list = readAgentList(baseConfig);
  const { list: nextList } = upsertAgentEntry(list, params.agentId, (entry) => {
    const next = { ...entry };
    if (params.payload.override) {
      next.heartbeat = buildHeartbeatOverride(params.payload.heartbeat);
    } else if ("heartbeat" in next) {
      delete next.heartbeat;
    }
    return next;
  });
  const patch = { agents: { list: nextList } };
  await applyGatewayConfigPatch({
    client: params.client,
    patch,
    baseHash: snapshot.hash ?? undefined,
    exists: snapshot.exists,
    sessionKey: params.sessionKey,
  });
  const nextConfig = writeAgentList(baseConfig, nextList);
  return resolveHeartbeatSettings(nextConfig, params.agentId);
};
