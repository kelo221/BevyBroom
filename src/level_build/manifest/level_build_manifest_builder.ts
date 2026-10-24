import type * as THREE from 'three';
import { PREVIEW_PROTOCOL_VERSION, type PreviewAuthoredState } from '@/preview/protocol/preview_protocol_types.js';
import { PreviewStateObjectCollector } from '@/preview/state/preview_state_object_collector.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import {
  LEVEL_BUILD_MANIFEST_VERSION,
  levelBuildNameSanitize,
  type LevelBuildManifest,
} from './level_build_manifest.js';

/**
 * Session id of every built level; a build is not part of a live editor
 * session.
 */
export const LEVEL_BUILD_SESSION_ID = 'build';

/** What a level manifest is built from. */
export interface LevelBuildManifestSource {
  /** Editor world root. */
  worldGroup: THREE.Object3D;
  /** Raw level name; sanitized into the directory name. */
  levelName: string;
  /** Project id the game must report. */
  projectIdentifier: string;
  /** Geometry revision of the build. */
  geometryRevision: number;
  /** Geometry GLB file name inside the level directory. */
  geometryFile: string;
  /** Game material ids the geometry uses. */
  materials: readonly string[];
}

/** Builds the manifest of a level package from the editor world. */
export class LevelBuildManifestBuilder {
  /**
   * Builds a version 2 manifest whose state holds every authored object.
   *
   * @param source World, names, revision and materials.
   * @returns Manifest ready to serialize.
   */
  static build(source: LevelBuildManifestSource): LevelBuildManifest {
    return {
      manifest_version: LEVEL_BUILD_MANIFEST_VERSION,
      protocol: PREVIEW_PROTOCOL_VERSION,
      level_name: levelBuildNameSanitize(source.levelName),
      geometry_file: source.geometryFile,
      geometry_revision: source.geometryRevision,
      state: LevelBuildManifestBuilder.stateBuild(source),
      materials: [...source.materials].sort(),
    };
  }

  /**
   * Builds the authored state snapshot of the world.
   *
   * @param source World, project id and revision.
   * @returns Authored state.
   */
  private static stateBuild(source: LevelBuildManifestSource): PreviewAuthoredState {
    return {
      protocol: PREVIEW_PROTOCOL_VERSION,
      project_id: source.projectIdentifier,
      document_id: documentIdentityEnsure(source.worldGroup),
      session_id: LEVEL_BUILD_SESSION_ID,
      revision: 1,
      geometry_revision: source.geometryRevision,
      objects: PreviewStateObjectCollector.collect(source.worldGroup),
    };
  }
}
