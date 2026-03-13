"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import {
  type SavedToken,
  loadTokenHistory,
  saveTokenHistory,
  upsertToken,
  renameToken,
  removeToken,
  maskToken,
} from "@/lib/auth/token-history";

// ---- Login form ----
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedTokens, setSavedTokens] = useState<SavedToken[]>([]);
  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const returnTo = searchParams?.get("returnTo") ?? "/";
  const paramError = searchParams?.get("error");
  const isSwitch = searchParams?.get("switch") === "1";

  useEffect(() => {
    setSavedTokens(loadTokenHistory());
  }, []);

  useEffect(() => {
    if (paramError === "invalid_token") {
      setError("Invalid or expired token.");
    }
  }, [paramError]);

  useEffect(() => {
    if (editingToken && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingToken]);

  const sortedTokens = useMemo(
    () => [...savedTokens].sort((a, b) => b.lastUsed - a.lastUsed),
    [savedTokens]
  );

  const doLogin = useCallback(
    async (tokenValue: string) => {
      const trimmed = tokenValue.trim();
      if (!trimmed) {
        setError("Please enter a token.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: trimmed }),
        });

        const data = (await response.json()) as {
          ok?: boolean;
          role?: string;
          error?: string;
          agentId?: string;
        };

        if (!response.ok || !data.ok) {
          setError(data.error ?? "Authentication failed.");
          setLoading(false);
          return;
        }

        // Save to history
        const role = data.role === "owner" ? "owner" : "shared";
        const updated = upsertToken(trimmed, role as "owner" | "shared", data.agentId);
        saveTokenHistory(updated);
        setSavedTokens(updated);

        if (data.role === "owner") {
          router.replace(returnTo || "/");
        } else if (data.role === "shared") {
          router.replace("/");
        }
      } catch {
        setError("Network error. Please try again.");
        setLoading(false);
      }
    },
    [returnTo, router]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void doLogin(token);
    },
    [token, doLogin]
  );

  const handleQuickLogin = useCallback(
    (saved: SavedToken) => {
      void doLogin(saved.token);
    },
    [doLogin]
  );

  const handleStartRename = useCallback((saved: SavedToken) => {
    setEditingToken(saved.token);
    setEditName(saved.name);
  }, []);

  const handleSaveRename = useCallback(() => {
    if (!editingToken) return;
    const updated = renameToken(editingToken, editName);
    saveTokenHistory(updated);
    setSavedTokens(updated);
    setEditingToken(null);
  }, [editingToken, editName]);

  const handleRemoveSaved = useCallback((tokenValue: string) => {
    const updated = removeToken(tokenValue);
    saveTokenHistory(updated);
    setSavedTokens(updated);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-card border border-border">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            OpenClaw Studio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSwitch ? "Switch to a different token" : "Enter your access token to continue"}
          </p>
        </div>

        {/* Saved tokens list */}
        {sortedTokens.length > 0 ? (
          <div className="mb-5">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Recent tokens
            </p>
            <div className="space-y-1.5">
              {sortedTokens.map((saved) => (
                <div
                  key={saved.token}
                  className="group flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 transition hover:border-ring/50"
                >
                  {editingToken === saved.token ? (
                    <div className="flex flex-1 items-center gap-1.5">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename();
                          if (e.key === "Escape") setEditingToken(null);
                        }}
                        className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground focus:border-ring focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSaveRename}
                        className="text-[10px] font-medium text-primary hover:underline"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingToken(null)}
                        className="text-[10px] text-muted-foreground hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleQuickLogin(saved)}
                        disabled={loading}
                        className="flex min-w-0 flex-1 flex-col items-start text-left disabled:opacity-50"
                      >
                        <span className="truncate text-sm font-medium text-foreground">
                          {saved.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {saved.role === "owner" ? "Admin" : saved.agentId ? `Agent: ${saved.agentId}` : "Shared"}{" "}
                          · {maskToken(saved.token)}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => handleStartRename(saved)}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Rename"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveSaved(saved.token)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Remove"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Manual token input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="token"
              className="block text-xs font-medium text-foreground mb-1.5"
            >
              {sortedTokens.length > 0 ? "Or enter a new token" : "Access Token"}
            </label>
            <input
              id="token"
              type="password"
              autoComplete="off"
              autoFocus={sortedTokens.length === 0}
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Paste your token..."
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              disabled={loading}
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {loading ? "Verifying..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
