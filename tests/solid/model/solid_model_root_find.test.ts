import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SOLID_MODEL_USERDATA_KEY } from '@/solid/model/solid_model_keys.js';
import { solidBrushWireOwnerIdRead, solidModelRootFind } from '@/solid/model/solid_model_root_find.js';

/**
 * Creates a group marked as a solid model root.
 *
 * @returns Solid model root group.
 */
function solidModelRootCreate(): THREE.Group {
  const root = new THREE.Group();
  root.userData[SOLID_MODEL_USERDATA_KEY] = true;
  return root;
}

/** Unit tests for locating the solid model that owns a brush. */
describe('solid_model_root_find', () => {
  it('finds the nearest solid model root through intermediate groups', () => {
    const root = solidModelRootCreate();
    const folder = new THREE.Group();
    const brush = new THREE.Mesh();
    root.add(folder);
    folder.add(brush);
    expect(solidModelRootFind(brush)).toBe(root);
    expect(solidBrushWireOwnerIdRead(brush)).toBe(root.uuid);
  });

  it('returns null and the brush id when no solid model owns the brush', () => {
    const plainGroup = new THREE.Group();
    const brush = new THREE.Mesh();
    plainGroup.add(brush);
    expect(solidModelRootFind(brush)).toBeNull();
    expect(solidBrushWireOwnerIdRead(brush)).toBe(brush.uuid);
  });

  it('gives every brush of one solid model the same wire owner id', () => {
    const root = solidModelRootCreate();
    const brushes = [new THREE.Mesh(), new THREE.Mesh(), new THREE.Mesh()];
    brushes.forEach((brush) => root.add(brush));
    const ownerIds = new Set(brushes.map((brush) => solidBrushWireOwnerIdRead(brush)));
    expect([...ownerIds]).toEqual([root.uuid]);
  });
});
