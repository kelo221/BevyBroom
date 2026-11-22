import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RunConfigurationProjectFileWriter } from '@/desktop/bun/run_configuration/run_configuration_project_file_writer.js';
import { RunConfigurationParser } from '@/project/run_configuration/model/run_configuration_parser.js';
import {
  RUN_CONFIGURATIONS_PROJECT_KEY,
  type RunConfiguration,
} from '@/project/run_configuration/model/run_configuration_types.js';

/** Folders the tests made, removed after each test. */
const temporaryDirectories: string[] = [];

/**
 * Creates a project file in a new temporary folder.
 *
 * @param project Project file content.
 * @returns Path of the project file.
 */
function projectFileCreate(project: Record<string, unknown>): string {
  const directory = mkdtempSync(join(tmpdir(), 'run-configuration-writer-'));
  temporaryDirectories.push(directory);
  const projectFile = join(directory, 'broom.project.json');
  writeFileSync(projectFile, JSON.stringify(project));
  return projectFile;
}

/**
 * Reads a project file back.
 *
 * @param projectFile Path of the project file.
 * @returns Parsed content.
 */
function projectFileRead(projectFile: string): Record<string, unknown> {
  return JSON.parse(readFileSync(projectFile, 'utf8')) as Record<string, unknown>;
}

/** Configuration the tests store. */
const WRITER_TEST_CONFIGURATION: RunConfiguration = {
  id: 'bake',
  name: 'Bake Lighting',
  steps: [
    { kind: 'level_save', enabled: true, fields: {} },
    { kind: 'command', enabled: false, fields: { program: 'cargo', arguments: ['run', '{level_id}'] } },
  ],
};

/**
 * The writer stores run configurations in the project file without touching its
 * other keys, and an empty list removes them.
 */
describe('RunConfigurationProjectFileWriter', () => {
  afterEach(() =>
    temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })),
  );

  it('stores configurations that read back the same and keeps every other key', () => {
    const projectFile = projectFileCreate({ project_id: 'game', preview: { program: 'cargo' } });
    new RunConfigurationProjectFileWriter().write(projectFile, [WRITER_TEST_CONFIGURATION]);
    const written = projectFileRead(projectFile);
    expect(written['project_id']).toBe('game');
    expect(written['preview']).toEqual({ program: 'cargo' });
    expect(RunConfigurationParser.projectRead(written)).toEqual([WRITER_TEST_CONFIGURATION]);
    expect(existsSync(`${projectFile}.run-configurations.tmp`)).toBe(false);
  });

  it('removes the key when the list is empty', () => {
    const projectFile = projectFileCreate({ project_id: 'game' });
    const writer = new RunConfigurationProjectFileWriter();
    writer.write(projectFile, [WRITER_TEST_CONFIGURATION]);
    writer.write(projectFile, []);
    expect(RUN_CONFIGURATIONS_PROJECT_KEY in projectFileRead(projectFile)).toBe(false);
  });
});
