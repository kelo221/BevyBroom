import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type * as THREE from 'three';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';

/** A temporary game project with one level document. */
export interface LevelExportTestProject {
  directory: string;
  projectFile: string;
  levelId: string;
  levelDirectory: string;
  documentFile: string;
}

/**
 * Creates a temporary project whose only level is a saved world.
 *
 * @param world World saved as the level document.
 * @param projectFields Extra project file fields, such as `tool_textures`.
 * @param classes Classes written to the project's class file.
 * @returns Paths of the project.
 */
export function levelExportTestProjectCreate(
  world: THREE.Group,
  projectFields: Record<string, unknown> = {},
  classes: readonly object[] = [],
): LevelExportTestProject {
  const directory = mkdtempSync(join(tmpdir(), 'broom_level_export_'));
  const levelId = 'export_hall';
  mkdirSync(join(directory, 'broom/documents'), { recursive: true });
  mkdirSync(join(directory, 'assets'), { recursive: true });
  writeFileSync(join(directory, 'broom/classes.json'), JSON.stringify({ classes }));
  const project = {
    project_version: 1,
    project_id: 'level-export-test',
    asset_root: 'assets',
    level_directory: 'levels',
    document_directory: 'broom/documents',
    entity_classes: 'broom/classes.json',
    ...projectFields,
  };
  const projectFile = join(directory, 'broom.project.json');
  writeFileSync(projectFile, JSON.stringify(project));
  const documentFile = join(directory, 'broom/documents', `${levelId}.json`);
  levelExportTestDocumentWrite(documentFile, world);
  return { directory, projectFile, levelId, levelDirectory: join(directory, 'assets/levels', levelId), documentFile };
}

/**
 * Saves a world as a level document.
 *
 * @param documentFile Document path.
 * @param world World to save.
 */
export function levelExportTestDocumentWrite(documentFile: string, world: THREE.Group): void {
  writeFileSync(documentFile, JSON.stringify(new SceneSerializer().serialize(world)));
}

/**
 * Removes a temporary project.
 *
 * @param project Project to remove.
 */
export function levelExportTestProjectRemove(project: LevelExportTestProject): void {
  rmSync(project.directory, { recursive: true, force: true });
}
