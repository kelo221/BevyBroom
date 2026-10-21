import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';
import { ObjectDataContributorRegistry } from '@/object_data/object_data_contributor_registry.js';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import type { ObjectEntry, SceneJSON } from '@/io/scene/io_types.js';
import { buildExportScene } from '@/io/scene/builder_export_scene.js';
import { PreviewStateObjectCollector } from '@/preview/state/preview_state_object_collector.js';
import type { PreviewAuthoredObject } from '@/preview/protocol/preview_protocol_types.js';
import { createContentMaterial } from '@/materials/factory_content_material.js';

/** UserData key the test contributor stores its tag under. */
const TEST_TAG_USERDATA_KEY = 'testContributorTag';

/** Field name the test contributor writes into files, previews and extras. */
const TEST_TAG_FIELD = 'test_contributor_tag';

/**
 * Reads or writes a field on a value through a string-keyed view.
 *
 * @param value Any object.
 * @returns String-keyed view of the same object.
 */
function recordView(value: object): Record<string, unknown> {
  return value as Record<string, unknown>;
}

/** Contributor that carries one userData tag through every hook. */
class TestTagContributor extends ObjectDataContributor {
  readonly contributorName = 'test_tag';
  readonly documentTagsRead: unknown[] = [];

  /**
   * Writes the tag of a tagged object into its entry.
   *
   * @param object Live object.
   * @param entry Entry being written.
   */
  override sceneEntryWrite(object: THREE.Object3D, entry: ObjectEntry): void {
    const tag: unknown = object.userData[TEST_TAG_USERDATA_KEY];
    if (typeof tag === 'string') recordView(entry)[TEST_TAG_FIELD] = tag;
  }

  /**
   * Restores the tag from an entry.
   *
   * @param entry Entry being read.
   * @param object Object created from the entry.
   */
  override sceneEntryRead(entry: ObjectEntry, object: THREE.Object3D): void {
    const tag = recordView(entry)[TEST_TAG_FIELD];
    if (typeof tag === 'string') object.userData[TEST_TAG_USERDATA_KEY] = tag;
  }

  /**
   * Writes a document-wide marker.
   *
   * @param _worldGroup World root.
   * @param scene Scene being written.
   */
  override sceneDocumentWrite(_worldGroup: THREE.Object3D, scene: SceneJSON): void {
    recordView(scene)[TEST_TAG_FIELD] = 'document';
  }

  /**
   * Remembers the document-wide marker.
   *
   * @param scene Scene being read.
   */
  override sceneDocumentRead(scene: SceneJSON): void {
    this.documentTagsRead.push(recordView(scene)[TEST_TAG_FIELD]);
  }

  /**
   * Copies the tag into the preview object.
   *
   * @param object Live object.
   * @param authored Preview object.
   */
  override previewPayloadAttach(object: THREE.Object3D, authored: PreviewAuthoredObject): void {
    const tag: unknown = object.userData[TEST_TAG_USERDATA_KEY];
    if (typeof tag === 'string') recordView(authored)[TEST_TAG_FIELD] = tag;
  }

  /**
   * Copies the tag into export extras.
   *
   * @param source Live object.
   * @param target Export node.
   */
  override exportExtrasWrite(source: THREE.Object3D, target: THREE.Object3D): void {
    const tag: unknown = source.userData[TEST_TAG_USERDATA_KEY];
    if (typeof tag === 'string') target.userData[TEST_TAG_FIELD] = tag;
  }
}

/**
 * Creates a world with one tagged content mesh.
 *
 * @param tag Tag stored on the mesh.
 * @returns World root and the mesh.
 */
function worldWithTaggedMesh(tag: string): { world: THREE.Group; mesh: THREE.Mesh } {
  const world = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), createContentMaterial(0xffffff));
  mesh.userData[TEST_TAG_USERDATA_KEY] = tag;
  world.add(mesh);
  return { world, mesh };
}

/**
 * A registered object data contributor carries its data through scene files,
 * the preview state and export extras without the core code knowing about it.
 */
describe('ObjectDataContributorRegistry', () => {
  let contributor: TestTagContributor;

  beforeEach(() => {
    contributor = new TestTagContributor();
    ObjectDataContributorRegistry.register(contributor);
  });

  afterEach(() => {
    ObjectDataContributorRegistry.unregister(contributor);
  });

  it('round-trips object and document data through a scene file', () => {
    const tag = THREE.MathUtils.generateUUID();
    const { world, mesh } = worldWithTaggedMesh(tag);
    const scene = new SceneSerializer().serialize(world);
    const loadedWorld = new THREE.Group();
    new SceneDeserializer().deserialize(JSON.parse(JSON.stringify(scene)) as SceneJSON, loadedWorld);
    const loaded = loadedWorld.getObjectByProperty('uuid', mesh.uuid);
    expect(loaded?.userData[TEST_TAG_USERDATA_KEY]).toBe(tag);
    expect(contributor.documentTagsRead).toEqual(['document']);
  });

  it('adds object data to the preview state', () => {
    const tag = THREE.MathUtils.generateUUID();
    const { world, mesh } = worldWithTaggedMesh(tag);
    const authored = PreviewStateObjectCollector.collect(world).find((object) => object.id === mesh.uuid);
    expect(authored ? recordView(authored)[TEST_TAG_FIELD] : undefined).toBe(tag);
  });

  it('writes object data into export extras', () => {
    const tag = THREE.MathUtils.generateUUID();
    const { world } = worldWithTaggedMesh(tag);
    const exported = buildExportScene(world).children[0];
    expect(exported?.userData[TEST_TAG_FIELD]).toBe(tag);
  });

  it('stops running a contributor once it is unregistered', () => {
    ObjectDataContributorRegistry.unregister(contributor);
    const { world } = worldWithTaggedMesh(THREE.MathUtils.generateUUID());
    expect(buildExportScene(world).children[0]?.userData[TEST_TAG_FIELD]).toBeUndefined();
  });
});
