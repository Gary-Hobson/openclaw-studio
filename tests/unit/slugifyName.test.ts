import { describe, expect, it } from "vitest";

import { slugifyName } from "@/lib/ids/slugify";

describe("slugifyName", () => {
  it("slugifies names", () => {
    expect(slugifyName("My Project")).toBe("my-project");
  });

  it("throws on empty slugs", () => {
    expect(() => slugifyName("!!!")).toThrow("Name produced an empty folder name.");
  });
});
