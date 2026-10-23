import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import type { SceneJSON } from '@/io/scene/io_types.js';
import { documentProjectLinkRead, documentProjectLinkWrite } from '@/project/document/document_project_link.js';

/**
 * Writes a world to scene file text and parses it back.
 *
 * @param world World to save.
 * @returns Saved scene file content.
 */
function sceneSaveAndParse(world: THREE.Group): SceneJSON {
  return JSON.parse(JSON.stringify(new SceneSerializer().serialize(world))) as SceneJSON;
}

/**
 * Unit tests for the document project link: a linked document remembers its
 * project through save and load, an unlinked one writes nothing, and clearing
 * or loading an unlinked file forgets the previous project.
 */
describe('ObjectDataContributorProjectLink', () => {
  it('keeps the project of a document through save and load', () => {
    const source = new THREE.Group();
    const projectIdentifier = `project-${Math.random().toString(36).slice(2)}`;
    documentProjectLinkWrite(source, projectIdentifier);
    const saved = sceneSaveAndParse(source);
    const loaded = new THREE.Group();
    new SceneDeserializer().deserialize(saved, loaded);
    expect(saved.projectId).toBe(projectIdentifier);
    expect(documentProjectLinkRead(loaded)).toBe(projectIdentifier);
  });

  it('writes no project for an unlinked document', () => {
    const saved = sceneSaveAndParse(new THREE.Group());
    expect('projectId' in saved).toBe(false);
  });

  it('forgets the previous project when an unlinked file is loaded or the scene is cleared', () => {
    const world = new THREE.Group();
    documentProjectLinkWrite(world, 'previous');
    new SceneDeserializer().deserialize(sceneSaveAndParse(new THREE.Group()), world);
    expect(documentProjectLinkRead(world)).toBeNull();
    documentProjectLinkWrite(world, 'previous');
    new SceneDeserializer().clearContent(world);
    expect(documentProjectLinkRead(world)).toBeNull();
  });
});
