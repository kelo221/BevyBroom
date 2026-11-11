import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import type { SceneJSON } from '@/io/scene/io_types.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { isSolidCsgGroup, markAsSolidCsgGroup } from '@/solid/model/solid_group.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import { createIndependentSolidModelDuplicate } from '@/solid/model/solid_model_duplicate.js';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import { modifierVolumeTemplateCreate } from '@/modifier/stack/modifier_volume_templates.js';
import { modifierVolumeBlacklistIgnores } from '@/modifier/volume/modifier_volume_blacklist.js';
import { modifierVolumeTargetFind, modifierVolumeTargetIdRead } from '@/modifier/volume/modifier_volume_target_id.js';
import { modifierBevelRefreshScene } from '@/modifier/compile/modifier_bevel_scene_refresh.js';
import { stackFixtureRequired, stackResultBounds } from '../../modifier/stack/modifier_stack_fixture.js';

/** Scene with modifier volumes inside a solid model and inside a CSG group. */
interface ModifierCodecScene {
  world: THREE.Group;
  model: SolidModel;
  group: THREE.Group;
  looseBrush: THREE.Object3D;
  groupedBrush: THREE.Object3D;
  rootVolume: THREE.Mesh;
  groupVolume: THREE.Mesh;
}

/**
 * Adds a box brush under a parent and returns its mesh.
 *
 * @param model Solid model.
 * @param parent Solid root or CSG group.
 * @param center Brush center in the parent's space.
 * @returns Brush mesh.
 */
function brushAdd(model: SolidModel, parent: THREE.Object3D, center: THREE.Vector3): THREE.Object3D {
  const mesh = stackFixtureRequired(model.addBoxBrush(1, SolidOperation.Additive, parent).mesh, 'a brush mesh');
  mesh.position.copy(center);
  return mesh;
}

/**
 * Adds a non-unit, moved and turned volume from a template under a parent.
 *
 * @param parent Solid root or CSG group.
 * @param templateId Volume template id.
 * @param size Box size of the volume geometry.
 * @returns Volume mesh.
 */
function volumeAdd(parent: THREE.Object3D, templateId: string, size: THREE.Vector3): THREE.Mesh {
  const volume = modifierVolumeTemplateCreate(templateId, new THREE.BoxGeometry(size.x, size.y, size.z));
  volume.position.set(size.x / 4, size.y / 3, -size.z / 5);
  volume.rotation.set(0, Math.PI / 7, 0);
  parent.add(volume);
  return volume;
}

/**
 * Builds a model with a loose brush, a CSG group holding a brush, a volume at
 * the model root excluding the group and the loose brush, and a volume inside
 * the group.
 *
 * @returns Scene parts.
 */
function sceneBuild(): ModifierCodecScene {
  const world = new THREE.Group();
  const model = new SolidModel('Codec volumes');
  world.add(model.root);
  const group = new THREE.Group();
  group.name = 'Grouped';
  markAsSolidCsgGroup(group, SolidOperation.Additive);
  model.root.add(group);
  const looseBrush = brushAdd(model, model.root, new THREE.Vector3(-3, 0, 0));
  const groupedBrush = brushAdd(model, group, new THREE.Vector3(3, 0, 0));
  const rootVolume = volumeAdd(model.root, 'linear', new THREE.Vector3(4, 2, 3));
  const groupVolume = volumeAdd(group, 'mirror', new THREE.Vector3(2, 5, 1));
  const settings = ModifierVolume.read(rootVolume);
  ModifierVolume.write(rootVolume, {
    ...settings,
    excludedIds: [modifierVolumeTargetIdRead(group), modifierVolumeTargetIdRead(looseBrush)],
  });
  model.syncBrushOrderFromScene();
  world.updateMatrixWorld(true);
  return { world, model, group, looseBrush, groupedBrush, rootVolume, groupVolume };
}

/**
 * Saves a world to scene JSON and loads it into a new world.
 *
 * @param world World to save.
 * @returns Loaded world.
 */
function sceneReload(world: THREE.Group): THREE.Group {
  const saved = JSON.parse(JSON.stringify(new SceneSerializer().serialize(world))) as SceneJSON;
  const loaded = new THREE.Group();
  new SceneDeserializer().deserialize(saved, loaded).forEach((object) => loaded.add(object));
  loaded.updateMatrixWorld(true);
  return loaded;
}

/**
 * Recompiles the modifier volumes of a world and returns the result bounds of
 * its only solid model.
 *
 * @param world World holding one solid model.
 * @returns Result mesh bounds.
 */
function modelResultBoundsRead(world: THREE.Group): THREE.Box3 {
  world.updateMatrixWorld(true);
  modifierBevelRefreshScene(world);
  const root = world.children.find((child) => SolidModel.isSolidModelObject(child));
  const model = stackFixtureRequired(root ? SolidModel.fromObject(root) : null, 'a solid model');
  model.rebuild(true);
  return stackResultBounds(model);
}

/**
 * Finds the object with a uuid under a root.
 *
 * @param root Search root.
 * @param uuid Object uuid.
 * @returns The object.
 */
function objectByUuid(root: THREE.Object3D, uuid: string): THREE.Object3D {
  return stackFixtureRequired(root.getObjectByProperty('uuid', uuid), `an object with uuid ${uuid}`);
}

/**
 * Returns the box geometry size of a volume.
 *
 * @param volume Volume mesh.
 * @returns Geometry size.
 */
function volumeSizeRead(volume: THREE.Object3D): THREE.Vector3 {
  if (!(volume instanceof THREE.Mesh)) throw new Error('Expected a volume mesh');
  const geometry = volume.geometry as THREE.BufferGeometry;
  geometry.computeBoundingBox();
  return stackFixtureRequired(geometry.boundingBox, 'volume bounds').getSize(new THREE.Vector3());
}

/**
 * Expects a loaded volume to match its source in parent, uuid, name, pose, box
 * and stack.
 *
 * @param loaded Loaded volume.
 * @param source Source volume.
 */
function expectVolumeRestored(loaded: THREE.Object3D, source: THREE.Mesh): void {
  expect(ModifierVolume.isVolume(loaded)).toBe(true);
  expect(loaded.parent?.uuid).toBe(source.parent?.uuid);
  expect(loaded.name).toBe(source.name);
  expect(loaded.matrix.equals(source.matrix)).toBe(true);
  expect(volumeSizeRead(loaded).distanceTo(volumeSizeRead(source))).toBeLessThan(1e-9);
  expect(ModifierVolume.read(loaded)).toEqual(ModifierVolume.read(source));
}

describe('modifier volumes inside solid models', () => {
  it('survive a save and load at the model root and inside a CSG group, with the group uuid kept', () => {
    const scene = sceneBuild();
    const loaded = sceneReload(scene.world);
    expect(objectByUuid(loaded, scene.group.uuid).parent?.uuid).toBe(scene.model.root.uuid);
    expectVolumeRestored(objectByUuid(loaded, scene.rootVolume.uuid), scene.rootVolume);
    expectVolumeRestored(objectByUuid(loaded, scene.groupVolume.uuid), scene.groupVolume);
  });

  it('rebuild the same modifier output after a reload', () => {
    const scene = sceneBuild();
    const before = modelResultBoundsRead(scene.world);
    const loaded = sceneReload(scene.world);
    const after = modelResultBoundsRead(loaded);
    expect(before.isEmpty()).toBe(false);
    expect(after.min.distanceTo(before.min) + after.max.distanceTo(before.max)).toBeLessThan(1e-6);
  });

  it('keep excluding the group and the brush they named after a reload', () => {
    const scene = sceneBuild();
    const loaded = sceneReload(scene.world);
    const volume = objectByUuid(loaded, scene.rootVolume.uuid);
    const ids = ModifierVolume.read(volume).excludedIds;
    expect(ids.map((id) => modifierVolumeTargetFind(loaded, id)?.name).sort()).toEqual(
      [scene.group.name, scene.looseBrush.name].sort(),
    );
    const groupedBrushId = modifierVolumeTargetIdRead(scene.groupedBrush);
    expect(modifierVolumeBlacklistIgnores(volume, modifierVolumeTargetFind(loaded, groupedBrushId) ?? null)).toBe(true);
  });

  it('are copied with a duplicated model under fresh ids that point at the copied group', () => {
    const scene = sceneBuild();
    const copy = createIndependentSolidModelDuplicate(scene.model);
    const copiedVolumes: THREE.Object3D[] = [];
    copy.root.traverse((object) => {
      if (ModifierVolume.isVolume(object)) copiedVolumes.push(object);
    });
    expect(copiedVolumes).toHaveLength(2);
    const originalIds = new Set([scene.rootVolume.uuid, scene.groupVolume.uuid, scene.group.uuid]);
    copy.root.traverse((object) => expect(object === copy.root || !originalIds.has(object.uuid)).toBe(true));
    const copiedRootVolume = stackFixtureRequired(
      copiedVolumes.find((volume) => volume.parent === copy.root),
      'the copied root volume',
    );
    const copiedGroup = copy.root.children.find((child) => isSolidCsgGroup(child));
    const copiedLooseBrush = copy.root.children.find((child) => SolidBrushVisual.isBrushObject(child));
    const excluded = ModifierVolume.read(copiedRootVolume).excludedIds.map((id) =>
      modifierVolumeTargetFind(copy.root, id),
    );
    expect(new Set(excluded)).toEqual(new Set([copiedGroup, copiedLooseBrush]));
    expect(excluded.every((object) => object !== undefined)).toBe(true);
  });
});
