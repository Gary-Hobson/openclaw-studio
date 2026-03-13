"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  loadTokenHistory,
  saveTokenHistory,
  upsertToken,
} from "@/lib/auth/token-history";

export default function SharedEntryPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    const token = params?.token;
    if (!token) {
      setError("No share token provided.");
      setValidating(false);
      return;
    }

    const validate = async () => {
      try {
        // Step 1: Log in with the share token via the auth API.
        // This sets the share cookie and clears any previous owner/share cookie.
        const loginResponse = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const loginData = (await loginResponse.json()) as {
          ok?: boolean;
          role?: string;
          agentId?: string;
          permissions?: string[];
          error?: string;
        };

        if (!loginResponse.ok || !loginData.ok) {
          setError(loginData.error ?? "Invalid share link.");
          setValidating(false);
          return;
        }

        // Step 2: Save token to localStorage history for future quick-login
        const agentId = loginData.agentId ?? undefined;
        const updated = upsertToken(token, "shared", agentId);
        saveTokenHistory(updated);

        // Step 3: Store share mode info in sessionStorage for the main page
        sessionStorage.setItem(
          "openclaw_shared_mode",
          JSON.stringify({
            active: true,
            agentId: agentId ?? null,
            permissions: loginData.permissions ?? [],
          })
        );

        // Step 4: Redirect to main page — cookie is already set by login API
        router.replace("/");
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setValidating(false);
      }
    };

    void validate();
  }, [params?.token, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md p-8">
        {validating ? (
          <div className="text-center">
            <h1 className="text-lg font-semibold text-foreground mb-2">
              Verifying access...
            </h1>
            <p className="text-sm text-muted-foreground">
              Checking your share link.
            </p>
          </div>
        ) : error ? (
          <div className="text-center">
            <h1 className="text-lg font-semibold text-red-500 mb-2">
              Access Denied
            </h1>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <p className="text-xs text-muted-foreground">
              This link may have been revoked or expired. Contact the owner for a
              new link.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
