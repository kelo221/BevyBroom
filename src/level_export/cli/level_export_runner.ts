import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { LevelPackageWriter } from '@/desktop/bun/level_build/level_package_writer.js';
import { ProjectLevelLister } from '@/desktop/bun/project_levels/project_level_lister.js';
import { ProjectLevelReader } from '@/desktop/bun/project_levels/project_level_reader.js';
import { GameEntityClassProviderProject } from '@/game_entity/class/game_entity_class_provider_project.js';
import { gameEntityClassListFromUnknown } from '@/game_entity/class/game_entity_class_schema.js';
import { documentIdentityWrite } from '@/io/document/document_identity.js';
import type { SceneJSON } from '@/io/scene/io_types.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import type { LevelExportCliArguments } from '@/level_export/cli/level_export_cli_arguments.js';
import { LevelExportPackageCheck } from '@/level_export/cli/level_export_package_check.js';
import { LevelExportPackageBuilder } from '@/level_export/package/level_export_package_builder.js';
import { levelBuildGeometryFileName } from '@/level_build/manifest/level_build_manifest.js';
import type { LevelBuildPublishRequest } from '@/level_build/publish/level_build_publish_types.js';
import type { ProjectDefinition } from '@/project/model/project_definition.js';
import { ProjectDefinitionParser } from '@/project/model/project_definition_parser.js';
import type { ProjectLevelSummary } from '@/project/level/project_level_types.js';
import { bytesToBase64 } from '@/utils/utils_base64.js';

/** Outcome of one command-line export. */
export interface LevelExportRunResult {
  ok: boolean;
  /** Line printed for the user. */
  message: string;
  /** Files that differ, when checking. */
  differences: string[];
}

/** FNV-1a offset basis. */
const LEVEL_EXPORT_HASH_OFFSET = 0x811c9dc5;

/** FNV-1a prime. */
const LEVEL_EXPORT_HASH_PRIME = 0x01000193;

/**
 * Exports one level of a project from the command line: reads the project and
 * the level document, rebuilds the level, and writes the level package, or
 * checks the package on disk against it. The geometry file is named after a
 * hash of its bytes, so the same document always gives the same files.
 */
export class LevelExportRunner {
  /**
   * Runs the export.
   *
   * @param options Parsed command-line options.
   * @returns What happened.
   */
  static async run(options: LevelExportCliArguments): Promise<LevelExportRunResult> {
    const projectFile = resolve(options.projectFile).replace(/\\/g, '/');
    const definition = ProjectDefinitionParser.parse(readFileSync(projectFile, 'utf8'), projectFile);
    const level = ProjectLevelLister.list(definition).find((candidate) => candidate.id === options.levelId);
    if (level === undefined) {
      return LevelExportRunner.failure(`No level ${options.levelId} in ${projectFile}`);
    }
    LevelExportRunner.projectClassesLoad(definition);
    const request = await LevelExportRunner.requestBuild(definition, level);
    const levelDirectory = options.outDirectory ?? `${definition.levelDirectory}/${request.levelName}`;
    return options.isCheck
      ? LevelExportRunner.check(levelDirectory, request)
      : LevelExportRunner.write(levelDirectory, request);
  }

  /**
   * Loads the level document and builds the package request.
   *
   * @param definition Parsed project.
   * @param level Level to export.
   * @returns Publish request with a content-derived geometry revision.
   */
  private static async requestBuild(
    definition: ProjectDefinition,
    level: ProjectLevelSummary,
  ): Promise<LevelBuildPublishRequest> {
    const worldGroup = LevelExportRunner.worldLoad(definition, level);
    const built = await LevelExportPackageBuilder.build({
      worldGroup,
      levelName: level.id,
      projectIdentifier: definition.projectIdentifier,
      toolTextures: definition.toolTextures,
    });
    return {
      levelName: built.manifest.level_name,
      glbBase64: bytesToBase64(built.glb),
      manifest: built.manifest,
      collisionJson: built.collisionJson,
      geometryRevision: LevelExportRunner.hashOf(built.glb),
    };
  }

  /**
   * Reads a level document into a new world, giving a document without an id
   * one derived from the level so repeated exports match.
   *
   * @param definition Parsed project.
   * @param level Level to read.
   * @returns Loaded world.
   * @throws Error when the document cannot be read.
   */
  private static worldLoad(definition: ProjectDefinition, level: ProjectLevelSummary): THREE.Group {
    const read = new ProjectLevelReader().read(definition, level.document);
    if (!read.ok) {
      throw new Error(read.message);
    }
    const document = JSON.parse(read.text) as SceneJSON;
    const worldGroup = new THREE.Group();
    new SceneDeserializer().deserialize(document, worldGroup);
    if (!document.documentId) {
      documentIdentityWrite(worldGroup, `level:${level.id}`);
    }
    return worldGroup;
  }

  /**
   * Makes the project's class file known, so component defaults and declared
   * collision kinds resolve as in the editor.
   *
   * @param definition Parsed project.
   */
  private static projectClassesLoad(definition: ProjectDefinition): void {
    if (definition.entityClassesFile === null) {
      return;
    }
    const list = gameEntityClassListFromUnknown(JSON.parse(readFileSync(definition.entityClassesFile, 'utf8')));
    if (list !== null) {
      GameEntityClassProviderProject.shared.listWrite(list);
    }
  }

  /**
   * Writes the package.
   *
   * @param levelDirectory Destination directory.
   * @param request Built level.
   * @returns Success with the written directory, or the writer's failure.
   */
  private static write(levelDirectory: string, request: LevelBuildPublishRequest): LevelExportRunResult {
    const written = new LevelPackageWriter().publish(levelDirectory, request);
    if (!written.ok) {
      return LevelExportRunner.failure(written.message);
    }
    return { ok: true, message: `Exported ${request.levelName} to ${levelDirectory}`, differences: [] };
  }

  /**
   * Compares the package on disk with the built one.
   *
   * @param levelDirectory Directory of the package.
   * @param request Built level.
   * @returns Success when current, else a failure naming the differing files.
   */
  private static check(levelDirectory: string, request: LevelBuildPublishRequest): LevelExportRunResult {
    const revision = request.geometryRevision ?? 0;
    const expected = LevelPackageWriter.packageFilesBuild(request, levelBuildGeometryFileName(revision), revision);
    const differences = LevelExportPackageCheck.differencesList(levelDirectory, expected);
    if (differences.length === 0) {
      return { ok: true, message: `${request.levelName} is up to date in ${levelDirectory}`, differences };
    }
    return { ok: false, message: `${request.levelName} is out of date in ${levelDirectory}`, differences };
  }

  /**
   * Returns a failure result.
   *
   * @param message Explanation.
   * @returns Failure.
   */
  private static failure(message: string): LevelExportRunResult {
    return { ok: false, message, differences: [] };
  }

  /**
   * Returns a 32-bit FNV-1a hash of bytes, used as the geometry revision.
   *
   * @param bytes Bytes to hash.
   * @returns Unsigned hash, at least one.
   */
  private static hashOf(bytes: Uint8Array): number {
    let hash = LEVEL_EXPORT_HASH_OFFSET;
    for (const byte of bytes) {
      hash = Math.imul(hash ^ byte, LEVEL_EXPORT_HASH_PRIME);
    }
    return (hash >>> 0) + 1;
  }
}
