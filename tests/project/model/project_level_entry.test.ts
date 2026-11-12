import { describe, expect, it } from 'vitest';
import {
  projectLevelDocumentFileNameIs,
  projectLevelDocumentFromName,
  projectLevelDocumentStemRead,
  projectLevelIdFromDocument,
} from '@/project/model/project_level_entry.js';

/** Level documents, ids and names derive from each other without surprises. */
describe('project level entry helpers', () => {
  it('accepts only .json documents regardless of case', () => {
    expect(projectLevelDocumentFileNameIs('castle.json')).toBe(true);
    expect(projectLevelDocumentFileNameIs('arenas/PIT.JSON')).toBe(true);
    expect(projectLevelDocumentFileNameIs('castle.json.bak')).toBe(false);
    expect(projectLevelDocumentFileNameIs('castle')).toBe(false);
  });

  it('reads the file stem of nested and extension-less documents', () => {
    expect(projectLevelDocumentStemRead('arenas/pit.json')).toBe('pit');
    expect(projectLevelDocumentStemRead('Castle Hall.json')).toBe('Castle Hall');
    expect(projectLevelDocumentStemRead('.hidden')).toBe('.hidden');
    expect(projectLevelDocumentStemRead('plain')).toBe('plain');
  });

  it('derives a game-safe level id from a document path, keeping nested documents apart', () => {
    expect(projectLevelIdFromDocument('Castle Hall.json')).toBe('castle_hall');
    expect(projectLevelIdFromDocument('arenas/pit.json')).toBe('arenas_pit');
    expect(projectLevelIdFromDocument('pit.json')).toBe('pit');
    expect(projectLevelIdFromDocument('arenas/pit.json')).not.toBe(projectLevelIdFromDocument('pit.json'));
  });

  it('derives a document file name from a typed level name', () => {
    expect(projectLevelDocumentFromName('Castle Hall')).toBe('castle_hall.json');
    expect(projectLevelDocumentFromName('   ')).toBe('level.json');
    expect(projectLevelDocumentFromName('../escape')).toBe('___escape.json');
  });
});
