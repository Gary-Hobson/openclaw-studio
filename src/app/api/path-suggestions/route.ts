import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { listPathAutocompleteEntries } from "@/lib/fs.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get("q");
    const query = rawQuery && rawQuery.trim() ? rawQuery.trim() : "~/";
    const result = listPathAutocompleteEntries({ query, maxResults: 10 });
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list path suggestions.";
    logger.error(message);
    const status = message.includes("does not exist") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
