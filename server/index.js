process.env.WS_NO_BUFFER_UTIL = process.env.WS_NO_BUFFER_UTIL || "1";
process.env.WS_NO_UTF_8_VALIDATE = process.env.WS_NO_UTF_8_VALIDATE || "1";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const next = require("next");

const { createAccessGate } = require("./access-gate");
const { createShareStore } = require("./share-store");
const { detectInstallContext, buildStartupGuidance } = require("./install-context");
const { assertPublicHostAllowed, resolveHosts } = require("./network-policy");

const resolvePort = () => {
  const raw = process.env.PORT?.trim() || "3000";
  const port = Number(raw);
  if (!Number.isFinite(port) || port <= 0) return 3000;
  return port;
};

const verifyNativeRuntime = (dev) => {
  if (process.env.OPENCLAW_SKIP_NATIVE_RUNTIME_VERIFY === "1") return;
  const scriptPath = path.resolve(__dirname, "..", "scripts", "verify-native-runtime.mjs");
  const modeArg = dev ? "--repair" : "--check";
  const result = spawnSync(process.execPath, [scriptPath, modeArg], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status === 0) return;
  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
  throw result.error ?? new Error("Failed to verify native runtime dependencies.");
};

async function main() {
  const dev = process.argv.includes("--dev");
  verifyNativeRuntime(dev);
  const hostnames = Array.from(new Set(resolveHosts(process.env)));
  const hostname = hostnames[0] ?? "127.0.0.1";
  const port = resolvePort();
  for (const host of hostnames) {
    assertPublicHostAllowed({
      host,
      studioAccessToken: process.env.STUDIO_ACCESS_TOKEN,
    });
  }

  // ---- Admin token: persist across restarts, only regenerate with --new-token ----
  const configuredToken = (process.env.STUDIO_ACCESS_TOKEN ?? "").trim();
  const forceNewToken = process.argv.includes("--new-token");

  if (!configuredToken) {
    const { resolveStudioSettingsPath } = require("./studio-settings");
    const settingsPath = resolveStudioSettingsPath(process.env);
    let existingToken = "";

    // Try to load persisted token from settings
    if (!forceNewToken) {
      try {
        if (fs.existsSync(settingsPath)) {
          const raw = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
          existingToken = (raw && typeof raw === "object" && typeof raw.adminToken === "string")
            ? raw.adminToken.trim()
            : "";
        }
      } catch {}
    }

    const adminToken = existingToken || crypto.randomBytes(24).toString("hex");
    process.env.STUDIO_ACCESS_TOKEN = adminToken;

    // Persist token to settings file
    try {
      const settingsDir = path.dirname(settingsPath);
      if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
      }
      let settings = {};
      try {
        if (fs.existsSync(settingsPath)) {
          const raw = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
          if (raw && typeof raw === "object") settings = raw;
        }
      } catch {}
      settings.adminToken = adminToken;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");
    } catch (err) {
      console.warn("Failed to persist admin token to settings:", err.message);
    }

    const tokenLabel = forceNewToken
      ? "Studio Admin Token (newly generated)"
      : existingToken
        ? "Studio Admin Token (from settings)"
        : "Studio Admin Token (auto-generated)";

    console.info("");
    console.info(`  ${tokenLabel}:`);
    console.info(`  ${adminToken}`);
    console.info("");
    if (!existingToken || forceNewToken) {
      console.info("  Use this token to log in at the /login page.");
      console.info("  Token is persisted. Use --new-token to regenerate.");
    } else {
      console.info("  Use --new-token to regenerate.");
    }
    console.info("");
  }

  const app = next({
    dev,
    hostname,
    port,
    ...(dev ? { webpack: true } : null),
  });
  const handle = app.getRequestHandler();

  const shareStore = createShareStore();
  // Expose share store globally for Next.js API routes to access
  globalThis.__openclawStudioShareStore = shareStore;

  // Revoke all share tokens when admin token is regenerated
  if (forceNewToken) {
    try {
      const revoked = shareStore.revokeAllShareTokens();
      if (revoked > 0) {
        console.info(`Revoked ${revoked} existing share token(s) due to --new-token.`);
      }
    } catch (err) {
      console.warn("Failed to revoke share tokens:", err.message);
    }
  }

  const accessGate = createAccessGate({
    token: process.env.STUDIO_ACCESS_TOKEN,
    shareStore,
  });

  await app.prepare();

  const createServer = () =>
    http.createServer((req, res) => {
      if (accessGate.handleHttp(req, res)) return;
      handle(req, res);
    });

  const servers = hostnames.map(() => createServer());

  const listenOnHost = (server, host) =>
    new Promise((resolve, reject) => {
      const onError = (err) => {
        server.off("error", onError);
        reject(err);
      };
      server.once("error", onError);
      server.listen(port, host, () => {
        server.off("error", onError);
        resolve();
      });
    });

  const closeServer = (server) =>
    new Promise((resolve) => {
      if (!server.listening) return resolve();
      server.close(() => resolve());
    });

  try {
    await Promise.all(servers.map((server, index) => listenOnHost(server, hostnames[index])));
  } catch (err) {
    await Promise.all(servers.map((server) => closeServer(server)));
    throw err;
  }

  const hostForBrowser = hostnames.some((value) => value === "127.0.0.1" || value === "::1")
    ? "localhost"
    : hostname === "0.0.0.0" || hostname === "::"
      ? "localhost"
      : hostname;

  const browserUrl = `http://${hostForBrowser}:${port}`;
  const adminToken = (process.env.STUDIO_ACCESS_TOKEN ?? "").trim();
  const loginUrl = adminToken
    ? `${browserUrl}?access_token=${adminToken}`
    : browserUrl;
  console.info(`Open in browser: ${loginUrl}`);
  try {
    const installContext = await detectInstallContext(process.env);
    const startupGuidance = buildStartupGuidance({
      installContext,
      port,
    });
    if (startupGuidance.length > 0) {
      console.info("");
      console.info("Studio access guidance:");
      for (const line of startupGuidance) {
        console.info(`- ${line}`);
      }
    }
  } catch (error) {
    console.error("Failed to print Studio access guidance.", error);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
