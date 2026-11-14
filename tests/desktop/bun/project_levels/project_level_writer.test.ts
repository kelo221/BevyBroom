import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, utimesSync } from 'node:fs';
import { ProjectLevelWriter } from '@/desktop/bun/project_levels/project_level_writer.js';
import {
  projectFileSystemNodeCreate,
  type ProjectFileSystem,
} from '@/desktop/bun/project_files/project_file_system_node.js';
import type { ProjectDefinition } from '@/project/model/project_definition.js';
import {
  projectLevelTestDirectoriesRemove,
  projectLevelTestDirectoryCreate,
  projectLevelTestDocumentWrite,
  projectLevelTestProjectWrite,
} from './project_level_test_project.js';

afterEach(() => projectLevelTestDirectoriesRemove());

/**
 * Reads a document of a project.
 *
 * @param definition Parsed project.
 * @param document Document path relative to the document directory.
 * @returns File text.
 */
function documentRead(definition: ProjectDefinition, document: string): string {
  return readFileSync(`${definition.documentDirectory}/${document}`, 'utf8');
}

/**
 * Moves the modification time of a document one minute into the future, as a
 * save by another program would.
 *
 * @param definition Parsed project.
 * @param document Document path relative to the document directory.
 */
function documentTouchLater(definition: ProjectDefinition, document: string): void {
  const later = new Date(Date.now() + 60_000);
  utimesSync(`${definition.documentDirectory}/${document}`, later, later);
}

/**
 * Returns real file operations whose rename onto documents fails.
 *
 * @returns File system that fails every rename onto a .json file.
 */
function fileSystemFailingOnDocumentRename(): ProjectFileSystem {
  const real = projectFileSystemNodeCreate();
  return {
    ...real,
    fileRename: (from, to) => {
      if (to.endsWith('.json')) {
        throw new Error('disk full');
      }
      real.fileRename(from, to);
    },
  };
}

/** The writer saves, creates and renames level documents without losing files. */
describe('ProjectLevelWriter', () => {
  it('creates the document directory and writes a new document at a known path', () => {
    const definition = projectLevelTestProjectWrite(projectLevelTestDirectoryCreate());
    const written = new ProjectLevelWriter().write(definition, {
      document: 'nested/hall.json',
      text: '{"version":1}',
      knownModifiedMilliseconds: null,
    });
    expect(written.ok).toBe(true);
    expect(documentRead(definition, 'nested/hall.json')).toBe('{"version":1}');
    expect(readdirSync(`${definition.documentDirectory}/nested`)).toEqual(['hall.json']);
    if (written.ok) {
      expect(written.level).toMatchObject({ id: 'nested_hall', document: 'nested/hall.json', isListed: false });
      expect(written.level.modifiedMilliseconds).toBeGreaterThan(0);
    }
  });

  it('refuses to overwrite a document another program changed, unless the check is skipped', () => {
    const definition = projectLevelTestProjectWrite(projectLevelTestDirectoryCreate());
    projectLevelTestDocumentWrite(definition, 'hall.json', 'old');
    const writer = new ProjectLevelWriter();
    const known = writer.write(definition, { document: 'hall.json', text: 'mine', knownModifiedMilliseconds: null });
    const knownModified = known.ok ? known.level.modifiedMilliseconds : null;
    documentTouchLater(definition, 'hall.json');
    const refused = writer.write(definition, {
      document: 'hall.json',
      text: 'lost',
      knownModifiedMilliseconds: knownModified,
    });
    expect(refused.ok).toBe(false);
    expect(refused.ok ? '' : refused.refusal).toBe('changed_on_disk');
    expect(documentRead(definition, 'hall.json')).toBe('mine');
    const forced = writer.write(definition, { document: 'hall.json', text: 'forced', knownModifiedMilliseconds: null });
    expect(forced.ok).toBe(true);
    expect(documentRead(definition, 'hall.json')).toBe('forced');
  });

  it('refuses invalid paths and leaves the old document when the write fails', () => {
    const definition = projectLevelTestProjectWrite(projectLevelTestDirectoryCreate());
    projectLevelTestDocumentWrite(definition, 'hall.json', 'old');
    const invalid = new ProjectLevelWriter().write(definition, {
      document: '../escape.json',
      text: 'x',
      knownModifiedMilliseconds: null,
    });
    expect(invalid.ok ? '' : invalid.refusal).toBe('invalid');
    const failed = new ProjectLevelWriter(fileSystemFailingOnDocumentRename()).write(definition, {
      document: 'hall.json',
      text: 'new',
      knownModifiedMilliseconds: null,
    });
    expect(failed.ok).toBe(false);
    expect(failed.ok ? '' : failed.message).toContain('disk full');
    expect(documentRead(definition, 'hall.json')).toBe('old');
  });

  it('creates a level from a name and refuses a second level with the same document', () => {
    const definition = projectLevelTestProjectWrite(projectLevelTestDirectoryCreate());
    const writer = new ProjectLevelWriter();
    const created = writer.create(definition, { name: 'Castle Hall', text: '{"a":1}' });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.level).toMatchObject({ id: 'castle_hall', name: 'castle_hall', document: 'castle_hall.json' });
    }
    expect(documentRead(definition, 'castle_hall.json')).toBe('{"a":1}');
    const again = writer.create(definition, { name: 'castle hall', text: '{"a":2}' });
    expect(again.ok ? '' : again.refusal).toBe('exists');
    expect(documentRead(definition, 'castle_hall.json')).toBe('{"a":1}');
    const unnamed = writer.create(definition, { name: '   ', text: '{}' });
    expect(unnamed.ok ? '' : unnamed.refusal).toBe('invalid');
  });

  it('renames an unlisted level by moving its document and refuses listed, missing or taken names', () => {
    const definition = projectLevelTestProjectWrite(projectLevelTestDirectoryCreate(), [
      { id: 'fixed', document: 'fixed.json' },
    ]);
    projectLevelTestDocumentWrite(definition, 'fixed.json', 'fixed');
    projectLevelTestDocumentWrite(definition, 'old.json', 'content');
    projectLevelTestDocumentWrite(definition, 'taken.json', 'taken');
    const writer = new ProjectLevelWriter();
    expect(writer.rename(definition, { document: 'fixed.json', name: 'Other' }).ok).toBe(false);
    expect(writer.rename(definition, { document: 'missing.json', name: 'Other' }).ok).toBe(false);
    const taken = writer.rename(definition, { document: 'old.json', name: 'Taken' });
    expect(taken.ok ? '' : taken.refusal).toBe('exists');
    const renamed = writer.rename(definition, { document: 'old.json', name: 'New Name' });
    expect(renamed.ok).toBe(true);
    if (renamed.ok) {
      expect(renamed.level).toMatchObject({ id: 'new_name', document: 'new_name.json', isListed: false });
    }
    expect(existsSync(`${definition.documentDirectory}/old.json`)).toBe(false);
    expect(documentRead(definition, 'new_name.json')).toBe('content');
  });
});
