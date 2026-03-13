"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Link2, Trash2, X } from "lucide-react";

import type { AgentState } from "@/features/agents/state/store";
import {
  listShares,
  createShare,
  revokeShare,
  type ShareTokenSummary,
  type CreatedShareToken,
} from "@/lib/shares/client";

type AgentSharePanelProps = {
  agent: AgentState;
  onClose: () => void;
};

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export default function AgentSharePanel({ agent, onClose }: AgentSharePanelProps) {
  const [shares, setShares] = useState<ShareTokenSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [justCreated, setJustCreated] = useState<CreatedShareToken | null>(null);
  const [copied, setCopied] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listShares(agent.agentId);
      setShares(result.filter((s) => !s.revoked));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shares.");
    } finally {
      setLoading(false);
    }
  }, [agent.agentId]);

  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  const handleCreate = useCallback(async () => {
    try {
      setCreating(true);
      setError(null);
      const share = await createShare({
        agentId: agent.agentId,
        label: newLabel.trim() || undefined,
        permissions: ["chat", "settings", "manage"],
      });
      setJustCreated(share);
      setNewLabel("");
      void loadShares();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create share link.");
    } finally {
      setCreating(false);
    }
  }, [agent.agentId, newLabel, loadShares]);

  const handleRevoke = useCallback(
    async (tokenId: string) => {
      try {
        setError(null);
        await revokeShare(tokenId);
        void loadShares();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to revoke share link.");
      }
    },
    [loadShares]
  );

  const buildShareUrl = (token: string) => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/shared/${encodeURIComponent(token)}`;
  };

  const handleCopyShareUrl = useCallback(
    async (share: ShareTokenSummary) => {
      try {
        const url = buildShareUrl(share.token);
        await navigator.clipboard.writeText(url);
        setCopiedId(share.id);
        setTimeout(() => setCopiedId((prev) => (prev === share.id ? null : prev)), 2000);
      } catch {}
    },
    []
  );

  const handleCopyLink = useCallback(
    async (token: string) => {
      try {
        await navigator.clipboard.writeText(buildShareUrl(token));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    },
    []
  );

  return (
    <div
      className="agent-inspect-panel flex min-h-0 flex-col overflow-hidden"
      data-testid="agent-share-panel"
    >
      <div className="flex items-center justify-between pl-4 pr-2 pb-3 pt-2">
        <div>
          <div className="font-mono text-[9px] font-medium tracking-[0.04em] text-muted-foreground/58">
            SHARING
          </div>
          <div className="text-sm font-semibold">{agent.name}</div>
        </div>
        <button
          onClick={onClose}
          className="ui-btn-ghost flex h-6 w-6 items-center justify-center rounded-md"
          aria-label="Close panel"
          data-testid="close-share-panel"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Create new share link */}
        <section className="mb-6">
          <h3 className="sidebar-section-title mb-2">Create Share Link</h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Generate a link to share this agent with others. They&apos;ll be able to chat and manage
            this agent, but won&apos;t see your other agents.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Label (optional)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="ui-input flex-1 text-xs"
              data-testid="share-label-input"
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="ui-btn-secondary flex items-center gap-1.5 text-xs px-3"
              data-testid="create-share-btn"
            >
              <Link2 size={12} />
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </section>

        {/* Just-created share link (shows full token once) */}
        {justCreated && (
          <section className="mb-6 ui-panel p-3">
            <div className="flex items-center gap-2 mb-2">
              <Link2 size={14} className="text-green-500" />
              <span className="text-xs font-medium text-green-600 dark:text-green-400">
                Share link created!
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">
              Copy this link now — the full token won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[10px] font-mono bg-muted/50 px-2 py-1.5 rounded truncate select-all">
                {buildShareUrl(justCreated.token)}
              </code>
              <button
                onClick={() => handleCopyLink(justCreated.token)}
                className="ui-btn-ghost flex h-7 w-7 items-center justify-center rounded-md shrink-0"
                title="Copy link"
              >
                <Copy size={12} />
              </button>
            </div>
            {copied && (
              <p className="text-[10px] text-green-500 mt-1">Copied to clipboard!</p>
            )}
            <button
              onClick={() => setJustCreated(null)}
              className="text-[10px] text-muted-foreground mt-2 underline"
            >
              Dismiss
            </button>
          </section>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 text-[11px] text-red-500">{error}</div>
        )}

        {/* Active share links */}
        <section>
          <h3 className="sidebar-section-title mb-2">Active Share Links</h3>
          {loading ? (
            <div className="text-[11px] text-muted-foreground">Loading...</div>
          ) : shares.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">
              No active share links for this agent.
            </div>
          ) : (
            <div className="space-y-2">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="ui-panel p-2.5 text-xs"
                  data-testid={`share-entry-${share.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {share.label || "Unnamed link"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Created {formatDate(share.createdAt)}
                        {share.expiresAt && ` · Expires ${formatDate(share.expiresAt)}`}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {share.token
                          ? share.token.slice(0, 12) + "••••" + share.token.slice(-12)
                          : share.tokenPreview}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={() => handleCopyShareUrl(share)}
                        className="ui-btn-ghost flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                        title="Copy share URL"
                        data-testid={`copy-share-${share.id}`}
                      >
                        <Copy size={11} />
                        {copiedId === share.id ? (
                          <span className="text-green-500">Copied!</span>
                        ) : (
                          <span>Copy URL</span>
                        )}
                      </button>
                      <button
                        onClick={() => handleRevoke(share.id)}
                        className="ui-btn-ghost flex h-6 w-6 items-center justify-center rounded-md text-red-500 hover:text-red-600"
                        title="Revoke link"
                        data-testid={`revoke-share-${share.id}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
