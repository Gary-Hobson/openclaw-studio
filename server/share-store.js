const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");

const NEW_STATE_DIRNAME = ".openclaw";

const resolveDefaultHomeDir = () => {
  const home = os.homedir();
  if (home) {
    try {
      if (fs.existsSync(home)) return home;
    } catch {}
  }
  return os.tmpdir();
};

const resolveStateDir = (env = process.env) => {
  const override = env.OPENCLAW_STATE_DIR?.trim();
  if (override) {
    const trimmed = override.trim();
    if (trimmed.startsWith("~")) {
      return path.resolve(trimmed.replace(/^~(?=$|[\\/])/, os.homedir()));
    }
    return path.resolve(trimmed);
  }
  return path.join(resolveDefaultHomeDir(), NEW_STATE_DIRNAME);
};

const SHARES_DB_DIRNAME = "openclaw-studio";
const SHARES_DB_FILENAME = "shares.db";

const resolveSharesDbPath = (env = process.env) =>
  path.join(resolveStateDir(env), SHARES_DB_DIRNAME, SHARES_DB_FILENAME);

function createShareStore(options = {}) {
  const dbPath = options.dbPath || resolveSharesDbPath(options.env || process.env);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let BetterSqlite3;
  try {
    BetterSqlite3 = require("better-sqlite3");
  } catch (err) {
    throw new Error(
      "better-sqlite3 is required for the share store. " + err.message
    );
  }

  const db = new BetterSqlite3(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS share_tokens (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      agent_id TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT '["chat","settings"]',
      label TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      revoked INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON share_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_share_tokens_agent_id ON share_tokens(agent_id);
  `);

  const insertStmt = db.prepare(`
    INSERT INTO share_tokens (id, token, agent_id, permissions, label, created_at, expires_at, revoked)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const findByTokenStmt = db.prepare(
    "SELECT * FROM share_tokens WHERE token = ?"
  );

  const findByIdStmt = db.prepare(
    "SELECT * FROM share_tokens WHERE id = ?"
  );

  const listAllStmt = db.prepare(
    "SELECT * FROM share_tokens ORDER BY created_at DESC"
  );

  const listByAgentStmt = db.prepare(
    "SELECT * FROM share_tokens WHERE agent_id = ? ORDER BY created_at DESC"
  );

  const revokeStmt = db.prepare(
    "UPDATE share_tokens SET revoked = 1 WHERE id = ?"
  );

  const revokeAllStmt = db.prepare(
    "UPDATE share_tokens SET revoked = 1 WHERE revoked = 0"
  );

  const generateId = () => crypto.randomUUID();
  const generateToken = () => crypto.randomBytes(32).toString("hex");

  const parsePermissions = (raw) => {
    if (typeof raw !== "string") return ["chat", "settings"];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : ["chat", "settings"];
    } catch {
      return ["chat", "settings"];
    }
  };

  const normalizeRow = (row) => {
    if (!row) return null;
    return {
      id: row.id,
      token: row.token,
      agentId: row.agent_id,
      permissions: parsePermissions(row.permissions),
      label: row.label || null,
      createdAt: row.created_at,
      expiresAt: row.expires_at || null,
      revoked: Boolean(row.revoked),
    };
  };

  const createShareToken = ({ agentId, permissions, label, expiresAt }) => {
    const normalizedAgentId = String(agentId ?? "").trim();
    if (!normalizedAgentId) {
      throw new Error("agentId is required to create a share token.");
    }

    const id = generateId();
    const token = generateToken();
    const perms = Array.isArray(permissions)
      ? permissions
      : ["chat", "settings"];
    const now = new Date().toISOString();

    insertStmt.run(
      id,
      token,
      normalizedAgentId,
      JSON.stringify(perms),
      label || null,
      now,
      expiresAt || null
    );

    return {
      id,
      token,
      agentId: normalizedAgentId,
      permissions: perms,
      label: label || null,
      createdAt: now,
      expiresAt: expiresAt || null,
      revoked: false,
    };
  };

  const validateShareToken = (token) => {
    const normalizedToken = String(token ?? "").trim();
    if (!normalizedToken) return null;

    const row = findByTokenStmt.get(normalizedToken);
    if (!row) return null;

    const normalized = normalizeRow(row);
    if (!normalized) return null;
    if (normalized.revoked) return null;

    if (normalized.expiresAt) {
      const expiresAt = new Date(normalized.expiresAt).getTime();
      if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
        return null;
      }
    }

    return normalized;
  };

  const getShareToken = (id) => {
    const normalizedId = String(id ?? "").trim();
    if (!normalizedId) return null;
    return normalizeRow(findByIdStmt.get(normalizedId));
  };

  const listShareTokens = (agentId) => {
    const normalizedAgentId = String(agentId ?? "").trim();
    const rows = normalizedAgentId
      ? listByAgentStmt.all(normalizedAgentId)
      : listAllStmt.all();
    return rows.map(normalizeRow).filter(Boolean);
  };

  const revokeShareToken = (id) => {
    const normalizedId = String(id ?? "").trim();
    if (!normalizedId) return false;
    const result = revokeStmt.run(normalizedId);
    return (result.changes ?? 0) > 0;
  };

  const revokeAllShareTokens = () => {
    const result = revokeAllStmt.run();
    return result.changes ?? 0;
  };

  const close = () => {
    db.close();
  };

  return {
    createShareToken,
    validateShareToken,
    getShareToken,
    listShareTokens,
    revokeShareToken,
    revokeAllShareTokens,
    close,
  };
}

module.exports = { createShareStore, resolveSharesDbPath };
