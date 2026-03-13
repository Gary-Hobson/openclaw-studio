// @vitest-environment node

import { describe, expect, it } from "vitest";

describe("createAccessGate", () => {
  it("rejects upgrade when token is unset (no cookie)", async () => {
    const { createAccessGate } = await import("../../server/access-gate");
    const gate = createAccessGate({ token: "" });
    // With no token configured, no one can authenticate
    expect(gate.allowUpgrade({ headers: {} })).toBe(false);
  });

  it("rejects /api requests without cookie when enabled", async () => {
    const { createAccessGate } = await import("../../server/access-gate");
    const gate = createAccessGate({ token: "abc" });

    let statusCode = 0;
    let ended = false;
    const res = {
      setHeader: () => {},
      end: () => {
        ended = true;
      },
      get statusCode() {
        return statusCode;
      },
      set statusCode(value: number) {
        statusCode = value;
      },
    };

    const handled = gate.handleHttp(
      { url: "/api/studio", headers: { host: "example.test" } },
      res
    );

    expect(handled).toBe(true);
    expect(statusCode).toBe(401);
    expect(ended).toBe(true);
  });

  it("allows upgrades when cookie matches", async () => {
    const { createAccessGate } = await import("../../server/access-gate");
    const gate = createAccessGate({ token: "abc" });
    expect(
      gate.allowUpgrade({ headers: { cookie: "studio_access=abc" } })
    ).toBe(true);
  });

  it("redirects unauthenticated page requests to /login", async () => {
    const { createAccessGate } = await import("../../server/access-gate");
    const gate = createAccessGate({ token: "abc" });

    let statusCode = 0;
    let locationHeader = "";
    const res = {
      setHeader: (name: string, value: string) => {
        if (name === "Location") locationHeader = value;
      },
      end: () => {},
      get statusCode() { return statusCode; },
      set statusCode(value: number) { statusCode = value; },
    };

    const handled = gate.handleHttp(
      { url: "/", headers: { host: "example.test" } },
      res,
    );

    expect(handled).toBe(true);
    expect(statusCode).toBe(302);
    expect(locationHeader).toContain("/login");
  });

  it("allows /login page without auth", async () => {
    const { createAccessGate } = await import("../../server/access-gate");
    const gate = createAccessGate({ token: "abc" });

    const res = {
      setHeader: () => {},
      end: () => {},
      get statusCode() { return 0; },
      set statusCode(_: number) {},
    };

    const handled = gate.handleHttp(
      { url: "/login", headers: { host: "example.test" } },
      res,
    );

    expect(handled).toBe(false);
  });
});
