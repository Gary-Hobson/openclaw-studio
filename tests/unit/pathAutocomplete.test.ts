import { afterEach, beforeEach, describe, expect, it } from "vitest";

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { listPathAutocompleteEntries } from "@/lib/fs.server";

let tempHome: string | null = null;

const setupHome = () => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-home-"));
  fs.mkdirSync(path.join(tempHome, "Documents"), { recursive: true });
  fs.mkdirSync(path.join(tempHome, "Downloads"), { recursive: true });
  fs.writeFileSync(path.join(tempHome, "Doc.txt"), "doc", "utf8");
  fs.writeFileSync(path.join(tempHome, "Notes.txt"), "notes", "utf8");
  fs.writeFileSync(path.join(tempHome, ".secret"), "hidden", "utf8");
};

const cleanupHome = () => {
  if (!tempHome) return;
  fs.rmSync(tempHome, { recursive: true, force: true });
  tempHome = null;
};

beforeEach(setupHome);
afterEach(cleanupHome);

describe("listPathAutocompleteEntries", () => {
  it("returns non-hidden entries for home", () => {
    const result = listPathAutocompleteEntries({
      query: "~/",
      homedir: () => tempHome ?? "",
      maxResults: 10,
    });

    expect(result.entries.map((entry) => entry.displayPath)).toEqual([
      "~/Documents/",
      "~/Downloads/",
      "~/Doc.txt",
      "~/Notes.txt",
    ]);
  });

  it("filters by prefix within the current directory", () => {
    const result = listPathAutocompleteEntries({
      query: "~/Doc",
      homedir: () => tempHome ?? "",
      maxResults: 10,
    });

    expect(result.entries.map((entry) => entry.displayPath)).toEqual([
      "~/Documents/",
      "~/Doc.txt",
    ]);
  });

  it("rejects paths outside the home directory", () => {
    expect(() =>
      listPathAutocompleteEntries({
        query: "~/../",
        homedir: () => tempHome ?? "",
        maxResults: 10,
      })
    ).toThrow(/home/i);
  });

  it("rejects missing directories", () => {
    expect(() =>
      listPathAutocompleteEntries({
        query: "~/Missing/",
        homedir: () => tempHome ?? "",
        maxResults: 10,
      })
    ).toThrow(/does not exist/i);
  });
});
