import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import type { SceneJSON } from '@/io/scene/io_types.js';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import { ModifierVolumeBevel } from '@/modifier/volume/modifier_volume_bevel.js';
import type { ModifierStackLegacyBevelEntry } from '@/modifier/stack/legacy/modifier_stack_legacy_bevel.js';
import { stackFixture } from '../modifier_stack_fixture.js';

/** Bevel settings a schema 7 scene stored, with every optional field set. */
const LEGACY_BEVEL: ModifierStackLegacyBevelEntry = {
  distance: 0.3,
  segments: 5,
  angleDegrees: 45,
  uvFlow: 'largest',
  uvLayout: 'tile',
  textureId: 'trim/legacy.png',
  blacklist: ['ignored-brush'],
  uvScaleU: 2,
  uvScaleV: 0.5,
  uvOffsetU: 0.25,
  uvOffsetV: 0.75,
  uvRotation: 90,
  uvOwner: 'single',
  uvPivot: 'center',
  uvSpace: 'world',
};

/**
 * Saves a scene with one bevel volume, then rewrites its entry the way a schema
 * 7 editor stored it.
 *
 * @returns Scene data with a legacy bevel entry and no modifier stack.
 */
function legacySceneData(): SceneJSON {
  const data = new SceneSerializer().serialize(stackFixture(['bevel']).world);
  for (const entry of data.objects) {
    if (!entry.modifierStack) continue;
    delete entry.modifierStack;
    entry.modifierBevel = structuredClone(LEGACY_BEVEL);
  }
  return { ...data, version: 7 };
}

/**
 * Loads scene data and returns its only modifier volume.
 *
 * @param data Scene data.
 * @returns Loaded volume.
 */
function volumeLoad(data: SceneJSON): THREE.Object3D {
  const loaded = new SceneDeserializer()
    .deserialize(data, new THREE.Group())
    .find((object) => ModifierVolume.isVolume(object));
  if (!loaded) throw new Error('Expected a modifier volume');
  return loaded;
}

describe('legacy bevel volume migration', () => {
  it('loads a schema 7 bevel volume as a single-brush stack with one equivalent bevel', () => {
    const volume = volumeLoad(legacySceneData());
    const stack = ModifierVolume.read(volume);
    expect(stack.grouping).toBe('brush');
    expect(stack.modifiers.map((entry) => entry.kind)).toEqual(['bevel']);
    expect(stack.excludedIds).toEqual(LEGACY_BEVEL.blacklist);
    const settings = ModifierVolumeBevel.readSettings(volume);
    expect(settings).toMatchObject({
      distance: LEGACY_BEVEL.distance,
      segments: LEGACY_BEVEL.segments,
      angleDegrees: LEGACY_BEVEL.angleDegrees,
      uvFlow: LEGACY_BEVEL.uvFlow,
      uvLayout: LEGACY_BEVEL.uvLayout,
      textureId: LEGACY_BEVEL.textureId,
      uvScaleU: LEGACY_BEVEL.uvScaleU,
      uvScaleV: LEGACY_BEVEL.uvScaleV,
      uvOffsetU: LEGACY_BEVEL.uvOffsetU,
      uvOffsetV: LEGACY_BEVEL.uvOffsetV,
      uvRotation: LEGACY_BEVEL.uvRotation,
      uvOwner: LEGACY_BEVEL.uvOwner,
      uvPivot: LEGACY_BEVEL.uvPivot,
      uvSpace: LEGACY_BEVEL.uvSpace,
    });
  });

  it('saves a migrated volume as a modifier stack only', () => {
    const world = new THREE.Group();
    world.add(volumeLoad(legacySceneData()));
    const resaved = new SceneSerializer().serialize(world);
    const entry = resaved.objects.find((object) => object.modifierStack !== undefined);
    expect(entry?.modifierBevel).toBeUndefined();
    expect(entry?.modifierStack?.modifiers.map((modifier) => modifier.kind)).toEqual(['bevel']);
    expect(ModifierVolumeBevel.readDistance(volumeLoad(resaved))).toBeCloseTo(LEGACY_BEVEL.distance);
  });
});
