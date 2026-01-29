import { NextResponse } from "next/server";

import type { Project, ProjectTile, ProjectsStore } from "@/lib/projects/types";
import { resolveProject, resolveProjectTile } from "@/lib/projects/resolve";
import { loadStore } from "@/app/api/projects/store";

export type ProjectResolveResponse =
  | { ok: true; projectId: string; project: Project }
  | { ok: false; response: NextResponse };

export type ProjectTileResolveResponse =
  | { ok: true; projectId: string; tileId: string; project: Project; tile: ProjectTile }
  | { ok: false; response: NextResponse };

export type ProjectResolveWithStoreResponse =
  | { ok: true; store: ProjectsStore; projectId: string; project: Project }
  | { ok: false; response: NextResponse };

export type ProjectTileResolveWithStoreResponse =
  | {
      ok: true;
      store: ProjectsStore;
      projectId: string;
      tileId: string;
      project: Project;
      tile: ProjectTile;
    }
  | { ok: false; response: NextResponse };

export const resolveProjectOrResponse = (
  store: ProjectsStore,
  projectId: string
): ProjectResolveResponse => {
  const resolved = resolveProject(store, projectId);
  if (!resolved.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: resolved.error.message },
        { status: resolved.error.status }
      ),
    };
  }
  return resolved;
};

export const resolveProjectTileOrResponse = (
  store: ProjectsStore,
  projectId: string,
  tileId: string
): ProjectTileResolveResponse => {
  const resolved = resolveProjectTile(store, projectId, tileId);
  if (!resolved.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: resolved.error.message },
        { status: resolved.error.status }
      ),
    };
  }
  return resolved;
};

export const resolveProjectFromParams = async (
  params: Promise<{ projectId: string }>
): Promise<ProjectResolveWithStoreResponse> => {
  const { projectId } = await params;
  const store = loadStore();
  const resolved = resolveProjectOrResponse(store, projectId);
  if (!resolved.ok) {
    return resolved;
  }
  return { ok: true, store, projectId: resolved.projectId, project: resolved.project };
};

export const resolveProjectTileFromParams = async (
  params: Promise<{ projectId: string; tileId: string }>
): Promise<ProjectTileResolveWithStoreResponse> => {
  const { projectId, tileId } = await params;
  const store = loadStore();
  const resolved = resolveProjectTileOrResponse(store, projectId, tileId);
  if (!resolved.ok) {
    return resolved;
  }
  return {
    ok: true,
    store,
    projectId: resolved.projectId,
    tileId: resolved.tileId,
    project: resolved.project,
    tile: resolved.tile,
  };
};
