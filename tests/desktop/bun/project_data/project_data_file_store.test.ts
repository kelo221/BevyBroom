import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectDataFileStore } from '@/desktop/bun/project_data/project_data_file_store.js';
import { ProjectDataLocationResolver } from '@/desktop/bun/project_data/project_data_location.js';
import type { ProjectDefinition } from '@/project/model/project_definition.js';

/** Temporary directories created by the tests, removed afterwards. */
const temporaryDirectories: string[] = [];

/**
 * Creates a temporary project directory whose name has spaces and non-ASCII
 * letters.
 *
 * @returns Absolute directory with forward slashes.
 */
function projectDirectoryCreate(): string {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'broom data ü '))).replace(/\\/g, '/');
  temporaryDirectories.push(directory);
  return directory;
}

/**
 * Builds a project definition that names a class file and a prefab directory.
 *
 * @param root Project directory.
 * @returns Project definition.
 */
function definitionCreate(root: string): ProjectDefinition {
  return {
    projectFile: `${root}/broom.project.json`,
    projectDirectory: root,
    projectIdentifier: 'game',
    name: 'Game',
    assetRoot: root,
    levelDirectory: `${root}/levels`,
    documentDirectory: `${root}/levels`,
    levels: [],
    textureDirectories: [],
    sprinkleDirectories: [],
    toolTextures: { nodraw: [] },
    runConfigurations: [],
    entityClassesFile: `${root}/broom/classes.json`,
    prefabDirectory: `${root}/broom/prefabs`,
    launch: null,
    build: null,
  };
}

/**
 * Returns the location of a kind, failing the test when the project names none.
 *
 * @param definition Project definition.
 * @param kind Kind of data.
 * @returns Location.
 */
function locationRead(definition: ProjectDefinition, kind: 'entity_classes' | 'prefabs') {
  const location = ProjectDataLocationResolver.locationRead(definition, kind);
  if (location === null) {
    throw new Error(`the test project names a location for ${kind}`);
  }
  return location;
}

/** Project data files are plain JSON files in the project folder. */
describe('ProjectDataFileStore', () => {
  afterEach(() => {
    temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
  });

  it('writes, lists and removes prefab files, creating the directory on first write', () => {
    const root = projectDirectoryCreate();
    const location = locationRead(definitionCreate(root), 'prefabs');
    const store = new ProjectDataFileStore();
    expect(store.readAll(location)).toEqual([]);
    expect(store.write(location, 'shelf_row.json', '{"a":1}')).toEqual({ ok: true });
    expect(store.write(location, 'aisle end.json', '{"b":2}')).toEqual({ ok: true });
    writeFileSync(`${location.directory}/notes.txt`, 'not a prefab');
    expect(store.readAll(location).map((file) => file.name)).toEqual(['aisle end.json', 'shelf_row.json']);
    expect(readFileSync(`${location.directory}/shelf_row.json`, 'utf8')).toBe('{"a":1}');
    expect(store.remove(location, 'shelf_row.json')).toEqual({ ok: true });
    expect(store.readAll(location).map((file) => file.name)).toEqual(['aisle end.json']);
  });

  it('refuses names with directories or without .json, and any other name for the class file', () => {
    const definition = definitionCreate(projectDirectoryCreate());
    const store = new ProjectDataFileStore();
    const prefabs = locationRead(definition, 'prefabs');
    expect(store.write(prefabs, '../escape.json', '{}').ok).toBe(false);
    expect(store.write(prefabs, 'shelf.txt', '{}').ok).toBe(false);
    const classes = locationRead(definition, 'entity_classes');
    expect(classes.fixedFileName).toBe('classes.json');
    expect(store.write(classes, 'other.json', '{}').ok).toBe(false);
    expect(store.write(classes, 'classes.json', '{"classes":[]}')).toEqual({ ok: true });
    expect(store.readAll(classes)).toEqual([{ name: 'classes.json', text: '{"classes":[]}' }]);
  });

  it('resolves the path of an existing data file to show, refusing missing files and foreign names', () => {
    const location = locationRead(definitionCreate(projectDirectoryCreate()), 'prefabs');
    const store = new ProjectDataFileStore();
    expect(store.existingPathResolve(location, 'kiosk.json').ok).toBe(false);
    store.write(location, 'kiosk.json', '{}');
    expect(store.existingPathResolve(location, 'kiosk.json')).toEqual({
      ok: true,
      path: `${location.directory}/kiosk.json`,
    });
    expect(store.existingPathResolve(location, '../kiosk.json').ok).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('refuses to read a file that links outside its directory', () => {
    const root = projectDirectoryCreate();
    const location = locationRead(definitionCreate(root), 'prefabs');
    mkdirSync(location.directory, { recursive: true });
    writeFileSync(`${root}/secret.json`, '{}');
    symlinkSync(`${root}/secret.json`, `${location.directory}/linked.json`);
    expect(() => new ProjectDataFileStore().readAll(location)).toThrow(/linked\.json/);
  });
});
