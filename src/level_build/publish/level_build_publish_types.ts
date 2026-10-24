import type { LevelBuildManifest } from '@/level_build/manifest/level_build_manifest.js';

/** A built level the desktop app writes into the open project's level directory. */
export interface LevelBuildPublishRequest {
  /** Level name; sanitized again by the writer. */
  levelName: string;
  /** Geometry GLB, base64 encoded. */
  glbBase64: string;
  /** Manifest; the writer fills in the geometry file name and revision. */
  manifest: LevelBuildManifest;
}

/** Where a published level package was written. */
export interface LevelBuildPublishSuccess {
  ok: true;
  /** Absolute level directory, forward slashes. */
  levelDirectory: string;
  /** Geometry file name the manifest names. */
  geometryFile: string;
  /** Geometry revision the manifest names. */
  geometryRevision: number;
  /** Older geometry files removed after the manifest was replaced. */
  removedGeometryFiles: string[];
}

/** Why a level package was not published; the previous package stays in place. */
export interface LevelBuildPublishFailure {
  ok: false;
  /** Explanation for the user. */
  message: string;
}

/** Outcome of publishing a level package. */
export type LevelBuildPublishResult = LevelBuildPublishSuccess | LevelBuildPublishFailure;
