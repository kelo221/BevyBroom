import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ObjectDuplicator } from '@/outliner/hierarchy/object_duplicator.js';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import type { ObjectEntry } from '@/io/scene/io_types.js';
import { SKIP_FACE_PICK_USERDATA_KEY } from '@/solid/model/solid_brush_visual.js';
import { getGeometrySource } from '@/texture/uv/geometry_source.js';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import { modifierVolumeTemplateCreate } from '@/modifier/stack/modifier_volume_templates.js';
import { MODIFIER_VOLUME_OUTLINE_KEY } from '@/modifier/volume/modifier_volume_bevel_keys.js';
import { stackFixtureRequired } from '../../modifier/stack/modifier_stack_fixture.js';

/**
 * Creates a non-unit array volume and duplicates it with an offset.
 *
 * @returns The source volume and its duplicate.
 */
function volumeDuplicate(): { source: THREE.Mesh; clone: THREE.Mesh } {
  const source = modifierVolumeTemplateCreate('linear', new THREE.BoxGeometry(2, 3, 5));
  source.position.set(1, -2, 4);
  const [clone] = ObjectDuplicator.duplicate([source], new THREE.Vector3(6, 0, 0));
  return { source, clone: stackFixtureRequired(clone, 'a duplicate') };
}

/**
 * Returns the outline children of a volume.
 *
 * @param volume Volume mesh.
 * @returns Outline line segments.
 */
function outlinesRead(volume: THREE.Object3D): THREE.LineSegments[] {
  return volume.children.filter(
    (child): child is THREE.LineSegments =>
      child instanceof THREE.LineSegments && child.userData[MODIFIER_VOLUME_OUTLINE_KEY] === true,
  );
}

/**
 * Serializes one object as a scene file stores it and drops the fields a
 * duplicate is meant to change.
 *
 * @param object Object to serialize.
 * @returns Its written entry without uuid, name and position.
 */
function entryComparable(object: THREE.Object3D): Partial<ObjectEntry> {
  const entry = stackFixtureRequired(new SceneSerializer().serializeRoots([object])[0], 'an entry');
  const { uuid: _uuid, name: _name, position: _position, ...rest } = entry;
  return JSON.parse(JSON.stringify(rest)) as Partial<ObjectEntry>;
}

describe('duplicating a modifier volume', () => {
  it('keeps one outline like the source while the fill stays hidden', () => {
    const { source, clone } = volumeDuplicate();
    const sourceOutlines = outlinesRead(source);
    const cloneOutlines = outlinesRead(clone);
    expect(cloneOutlines).toHaveLength(sourceOutlines.length);
    expect(cloneOutlines).toHaveLength(1);
    const outline = stackFixtureRequired(cloneOutlines[0], 'an outline');
    const sourceOutline = stackFixtureRequired(sourceOutlines[0], 'a source outline');
    expect(outline.visible).toBe(true);
    expect(outline.geometry.getAttribute('position').count).toBe(sourceOutline.geometry.getAttribute('position').count);
    expect(ModifierVolume.isFillVisible(clone)).toBe(false);
  });

  it('is skipped by face picking and keeps the geometry source', () => {
    const { source, clone } = volumeDuplicate();
    expect(clone.userData[SKIP_FACE_PICK_USERDATA_KEY]).toBe(true);
    expect(getGeometrySource(clone)).toEqual(getGeometrySource(source));
    expect(getGeometrySource(clone)).not.toBeNull();
  });

  it('serializes like the original apart from its identity and place', () => {
    const { source, clone } = volumeDuplicate();
    expect(entryComparable(clone)).toEqual(entryComparable(source));
    expect(ModifierVolume.read(clone)).toEqual(ModifierVolume.read(source));
  });
});
