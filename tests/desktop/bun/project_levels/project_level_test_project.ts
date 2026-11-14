import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ProjectDefinition } from '@/project/model/project_definition.js';
import { ProjectDefinitionParser } from '@/project/model/project_definition_parser.js';

/** Temporary directories created by the running test file. */
const projectLevelTestDirectories: string[] = [];

/** Document directory of the temporary projects, relative to the project file. */
export const PROJECT_LEVEL_TEST_DOCUMENT_DIRECTORY = 'broom/documents';

/**
 * Creates a fresh temporary project directory.
 *
 * @returns Absolute project directory with forward slashes.
 */
export function projectLevelTestDirectoryCreate(): string {
  const directory = mkdtempSync(join(tmpdir(), 'broom-project-levels-'));
  projectLevelTestDirectories.push(directory);
  return directory.replace(/\\/g, '/');
}

/**
 * Writes a file below a directory, creating its parent directories.
 *
 * @param baseDirectory Absolute directory the path is relative to.
 * @param relativePath Forward-slash path of the file.
 * @param contents File contents.
 */
export function projectLevelTestFileWrite(baseDirectory: string, relativePath: string, contents: string): void {
  const filePath = join(baseDirectory, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

/**
 * Creates a link below a directory pointing at a target path.
 *
 * @param baseDirectory Absolute directory the link path is relative to.
 * @param relativePath Forward-slash path of the link.
 * @param target Absolute path the link points at.
 */
export function projectLevelTestLinkWrite(baseDirectory: string, relativePath: string, target: string): void {
  const linkPath = join(baseDirectory, relativePath);
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath);
}

/**
 * Writes a project file into a directory and parses it.
 *
 * @param projectDirectory Absolute project directory.
 * @param levels Explicit level entries of the project file.
 * @returns Parsed project definition.
 */
export function projectLevelTestProjectWrite(projectDirectory: string, levels: unknown[] = []): ProjectDefinition {
  const project = {
    project_version: 1,
    project_id: 'level-project',
    asset_root: 'assets',
    material_catalog: 'broom/materials.json',
    level_directory: 'broom/levels',
    document_directory: PROJECT_LEVEL_TEST_DOCUMENT_DIRECTORY,
    levels,
    preview: { program: 'cargo', arguments: ['run'], endpoint: 'http://127.0.0.1:15999' },
  };
  const text = JSON.stringify(project);
  projectLevelTestFileWrite(projectDirectory, 'broom.project.json', text);
  mkdirSync(join(projectDirectory, 'assets'), { recursive: true });
  return ProjectDefinitionParser.parse(text, `${projectDirectory}/broom.project.json`);
}

/**
 * Writes a scene document into the document directory of a project.
 *
 * @param definition Parsed project.
 * @param document Document path relative to the document directory.
 * @param text Scene document text.
 */
export function projectLevelTestDocumentWrite(definition: ProjectDefinition, document: string, text: string): void {
  projectLevelTestFileWrite(definition.documentDirectory, document, text);
}

/** Removes every temporary directory created so far. */
export function projectLevelTestDirectoriesRemove(): void {
  projectLevelTestDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
}
