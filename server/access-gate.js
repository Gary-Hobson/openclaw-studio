const { URL } = require("node:url");

const parseCookies = (header) => {
  const raw = typeof header === "string" ? header : "";
  if (!raw.trim()) return {};
  const out = {};
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = value;
  }
  return out;
};

const buildRedirectUrl = (req, nextPathWithQuery) => {
  const host = req.headers?.host || "localhost";
  const proto =
    String(req.headers?.["x-forwarded-proto"] || "").toLowerCase() === "https"
      ? "https"
      : "http";
  return `${proto}://${host}${nextPathWithQuery}`;
};

function createAccessGate(options) {
  const token = String(options?.token ?? "").trim();
  const cookieName = String(options?.cookieName ?? "studio_access").trim() || "studio_access";
  const queryParam = String(options?.queryParam ?? "access_token").trim() || "access_token";
  const shareStore = options?.shareStore ?? null;

  const shareCookieName = "studio_share";
  const shareQueryParam = "share_token";

  // Token is ALWAYS required now (auto-generated if not configured)
  const enabled = Boolean(token);

  const isOwnerAuthorized = (req) => {
    if (!enabled) return false;
    const cookieHeader = req.headers?.cookie;
    const cookies = parseCookies(cookieHeader);
    return cookies[cookieName] === token;
  };

  const resolveShareTokenFromRequest = (req) => {
    if (!shareStore) return null;
    const cookieHeader = req.headers?.cookie;
    const cookies = parseCookies(cookieHeader);
    const cookieToken = cookies[shareCookieName];
    if (cookieToken) {
      const validated = shareStore.validateShareToken(cookieToken);
      if (validated) return { ...validated, fromCookie: true };
    }
    return null;
  };

  const injectScopeHeader = (req, scope) => {
    req.headers = req.headers || {};
    req.headers["x-studio-scope"] = JSON.stringify(scope);
  };

  const isNextInternalPath = (pathname) =>
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json";

  // Pages that unauthenticated users can access
  const isPublicPath = (pathname) =>
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/shared/");

  // API routes that unauthenticated users can call
  const isPublicApiPath = (pathname) =>
    pathname === "/api/auth/login" ||
    pathname === "/api/shares/validate";

  const handleHttp = (req, res) => {
    const host = req.headers?.host || "localhost";
    const url = new URL(req.url || "/", `http://${host}`);

    // Always allow Next.js static assets
    if (isNextInternalPath(url.pathname)) {
      return false;
    }

    // ---- Handle share_token query param (redirect & set cookie) ----
    if (shareStore) {
      const shareTokenParam = url.searchParams.get(shareQueryParam);
      if (shareTokenParam !== null) {
        const validated = shareStore.validateShareToken(shareTokenParam);
        if (!validated) {
          res.statusCode = 302;
          res.setHeader("Location", buildRedirectUrl(req, "/login?error=invalid_token"));
          res.end();
          return true;
        }
        url.searchParams.delete(shareQueryParam);
        const redirectTarget = url.pathname + url.search;
        const cookieValue = `${shareCookieName}=${validated.token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=31536000`;
        res.statusCode = 302;
        res.setHeader("Set-Cookie", cookieValue);
        res.setHeader("Location", buildRedirectUrl(req, redirectTarget));
        res.end();
        return true;
      }
    }

    // ---- Handle access_token query param (redirect & set cookie) ----
    if (enabled) {
      const provided = url.searchParams.get(queryParam);
      if (provided !== null) {
        if (provided !== token) {
          res.statusCode = 302;
          res.setHeader("Location", buildRedirectUrl(req, "/login?error=invalid_token"));
          res.end();
          return true;
        }
        url.searchParams.delete(queryParam);
        const cookieValue = `${cookieName}=${token}; HttpOnly; Path=/; SameSite=Lax`;
        res.statusCode = 302;
        res.setHeader("Set-Cookie", cookieValue);
        res.setHeader("Location", buildRedirectUrl(req, url.pathname + url.search));
        res.end();
        return true;
      }
    }

    // ---- Resolve auth ----
    // Priority: owner cookie > share cookie > unauthenticated
    const ownerAuthed = isOwnerAuthorized(req);
    const shareValidation = ownerAuthed ? null : resolveShareTokenFromRequest(req);
    const authenticated = ownerAuthed || Boolean(shareValidation);

    // ---- Public paths (login page, shared entry, public API) ----
    if (isPublicPath(url.pathname)) {
      // Inject scope if authenticated (for shared entry pages)
      if (ownerAuthed) {
        injectScopeHeader(req, { role: "owner" });
      } else if (shareValidation) {
        injectScopeHeader(req, {
          role: "shared",
          agentId: shareValidation.agentId,
          permissions: shareValidation.permissions,
        });
      }
      return false;
    }

    if (url.pathname.startsWith("/api/") && isPublicApiPath(url.pathname)) {
      return false;
    }

    // ---- All other routes require authentication ----
    if (!authenticated) {
      if (url.pathname.startsWith("/api/")) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
          error: "Authentication required. Please log in with your token.",
          loginUrl: "/login",
        }));
        return true;
      }

      // Redirect pages to /login
      const returnTo = url.pathname + url.search;
      const loginUrl = returnTo && returnTo !== "/"
        ? `/login?returnTo=${encodeURIComponent(returnTo)}`
        : "/login";
      res.statusCode = 302;
      res.setHeader("Location", buildRedirectUrl(req, loginUrl));
      res.end();
      return true;
    }

    // ---- Authenticated: inject scope ----
    if (ownerAuthed) {
      injectScopeHeader(req, { role: "owner" });
    } else if (shareValidation) {
      injectScopeHeader(req, {
        role: "shared",
        agentId: shareValidation.agentId,
        permissions: shareValidation.permissions,
      });
    }

    return false;
  };

  const allowUpgrade = (req) => {
    if (isOwnerAuthorized(req)) return true;
    if (resolveShareTokenFromRequest(req)) return true;
    return false;
  };

  return { enabled, handleHttp, allowUpgrade };
}

module.exports = { createAccessGate };
