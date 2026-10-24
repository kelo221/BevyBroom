import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProviderRegistry } from '@/info_panel/issues/issue_provider_registry.js';
import type { GameProcessControl } from '@/project/control/game_process_control.js';
import { bytesToBase64 } from '@/utils/utils_base64.js';
import { levelBuildNameSanitize } from '@/level_build/manifest/level_build_manifest.js';
import { LevelBuildManifestBuilder } from '@/level_build/manifest/level_build_manifest_builder.js';
import { levelBuildGlbMaterialIdsRead } from '@/level_build/package/level_build_glb_material_reader.js';
import type {
  LevelBuildPublishRequest,
  LevelBuildPublishSuccess,
} from '@/level_build/publish/level_build_publish_types.js';

/** Editor parts Build Level reads and the services it calls. */
export interface ControllerLevelBuildDeps {
  /** Editor world root. */
  worldGroup: THREE.Group;
  /** Returns the control that writes into the open project. */
  gameProcessControlRead: () => GameProcessControl;
  /** Returns the default level name, derived from the scene file name. */
  levelNameRead: () => string;
  /** Exports the world as the GLB the game loads. */
  glbExport: (worldGroup: THREE.Group) => Promise<ArrayBuffer>;
  /** Collects the problems of the world; the issue providers by default. */
  issuesCollect?: (worldGroup: THREE.Object3D) => Issue[];
}

/** A level package that was written, with what it holds. */
export interface LevelBuildSuccess extends LevelBuildPublishSuccess {
  /** Sanitized level name. */
  levelName: string;
  /** Number of authored objects in the manifest. */
  objectCount: number;
  /** Game material ids the geometry uses. */
  materials: string[];
}

/** Why no level package was written. */
export interface LevelBuildFailure {
  ok: false;
  /** Explanation for the user. */
  message: string;
  /** Problems that stopped the build, empty when something else failed. */
  problems: Issue[];
}

/** Outcome of Build Level. */
export type LevelBuildResult = LevelBuildSuccess | LevelBuildFailure;

/**
 * Builds a level package the game loads without the editor: checks the world
 * for errors, exports the geometry, writes the manifest and publishes both into
 * the open project's level directory in one step.
 */
export class ControllerLevelBuild {
  /**
   * Creates the controller.
   *
   * @param deps World, project control, level name and exporter.
   */
  constructor(private readonly deps: ControllerLevelBuildDeps) {}

  /**
   * Builds and publishes the level.
   *
   * @param levelName Level name; the scene-derived name when omitted.
   * @returns Where the package went, or why nothing was written.
   */
  async build(levelName?: string): Promise<LevelBuildResult> {
    const control = this.deps.gameProcessControlRead();
    const projectIdentifier = (await control.statusRead()).project?.projectIdentifier ?? '';
    if (!control.isAvailable || projectIdentifier === '') {
      return this.failureCreate('Open a game project in the desktop app before building a level.');
    }
    const problems = this.preflightErrorsCollect();
    if (problems.length > 0) {
      return this.failureCreate(`Build stopped by ${problems.length} error(s) in the Issues list.`, problems);
    }
    const request = await this.requestBuild(
      levelBuildNameSanitize(levelName ?? this.deps.levelNameRead()),
      projectIdentifier,
    );
    const published = await control.levelPackagePublish(request);
    if (!published.ok) {
      return this.failureCreate(published.message);
    }
    const objectCount = request.manifest.state.objects.length;
    return { ...published, levelName: request.levelName, objectCount, materials: request.manifest.materials };
  }

  /**
   * Collects the error issues that stop a build.
   *
   * @returns Error issues.
   */
  private preflightErrorsCollect(): Issue[] {
    const issuesCollect = this.deps.issuesCollect ?? ((world) => IssueProviderRegistry.issuesCollect(world));
    return issuesCollect(this.deps.worldGroup).filter((issue) => issue.severity === 'error');
  }

  /**
   * Exports the geometry and builds the publish request.
   *
   * @param levelName Sanitized level name.
   * @param projectIdentifier Id of the open project.
   * @returns Request whose geometry file the writer names.
   */
  private async requestBuild(levelName: string, projectIdentifier: string): Promise<LevelBuildPublishRequest> {
    const glb = new Uint8Array(await this.deps.glbExport(this.deps.worldGroup));
    const manifest = LevelBuildManifestBuilder.build({
      worldGroup: this.deps.worldGroup,
      levelName,
      projectIdentifier,
      geometryRevision: 0,
      geometryFile: '',
      materials: levelBuildGlbMaterialIdsRead(glb),
    });
    return { levelName, glbBase64: bytesToBase64(glb), manifest };
  }

  /**
   * Builds a failure result.
   *
   * @param message Explanation for the user.
   * @param problems Problems that stopped the build.
   * @returns Failure result.
   */
  private failureCreate(message: string, problems: Issue[] = []): LevelBuildFailure {
    return { ok: false, message, problems };
  }
}
