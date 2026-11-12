import * as THREE from 'three';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import { modifierBevelRefreshScene } from '@/modifier/compile/modifier_bevel_scene_refresh.js';
import { modifierStackBrushTouches } from '@/modifier/stack/evaluate/modifier_stack_capture.js';
import type { ModifierStackVolumeOperation } from '@/modifier/stack/modifier_stack_types.js';

/** Edge length of the brushes the operation scenes build. */
export const OPERATION_FIXTURE_BRUSH_SIZE = 2;

/**
 * Builds a world with two additive brushes side by side along X and a volume
 * whose geometry has no thickness on Y, resting on their top faces, the way a
 * volume drawn flat in a top view does. The scene is refreshed once.
 *
 * @returns World, solid, volume, and how many brushes the flat volume touches.
 */
export function operationFlatVolumeScene() {
  const world = new THREE.Group();
  const model = new SolidModel('Flat operation volume test');
  world.add(model.root);
  const size = OPERATION_FIXTURE_BRUSH_SIZE;
  const left = model.addBoxBrush(size, SolidOperation.Additive);
  const right = model.addBoxBrush(size, SolidOperation.Additive);
  left.mesh?.position.set(-size / 2, 0, 0);
  right.mesh?.position.set(size / 2, 0, 0);
  model.markBrushesDirty([left.id, right.id]);
  model.rebuild();
  const volume = ModifierVolume.create({ modifiers: [] }, new THREE.BoxGeometry(size * 4, 0, size * 4));
  volume.position.y = new THREE.Box3().setFromObject(model.root).max.y;
  world.add(volume);
  world.updateMatrixWorld(true);
  modifierBevelRefreshScene(world);
  const touchedBrushes = model.getBrushes().filter((brush) => modifierStackBrushTouches(brush, volume)).length;
  return { world, model, volume, touchedBrushes };
}

/**
 * Stores a volume operation and refreshes the scene, as an inspector edit does.
 *
 * @param world Scene root.
 * @param volume Modifier volume.
 * @param operation Operation to store.
 */
export function operationFixtureSet(
  world: THREE.Object3D,
  volume: THREE.Object3D,
  operation: ModifierStackVolumeOperation,
): void {
  ModifierVolume.write(volume, { ...ModifierVolume.read(volume), operation });
  modifierBevelRefreshScene(world);
}
