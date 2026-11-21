import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  OUTLINER_NAMING_GROUP_FALLBACK_BASE,
  OutlinerNamingGroupComposition,
} from '@/outliner/naming/outliner_naming_group_composition.js';
import { HierarchyNameAllocator } from '@/utils/utils_hierarchy_name_allocator.js';

/**
 * Builds members named by a fresh allocator, the way new objects are named.
 *
 * @param bases Name base of each member, one entry per member.
 * @returns Named members in the given order.
 */
function membersNamed(bases: readonly string[]): THREE.Object3D[] {
  const allocator = new HierarchyNameAllocator();
  return bases.map((base) => {
    const member = new THREE.Object3D();
    member.name = allocator.allocate(base);
    return member;
  });
}

describe('OutlinerNamingGroupComposition', () => {
  it('names a group of one kind by the kind and its count, without id suffixes', () => {
    expect(OutlinerNamingGroupComposition.nameBaseFromMembers(membersNamed(['Box', 'Box', 'Box']))).toBe('Box x3');
  });

  it('names a group of one member after that member', () => {
    expect(OutlinerNamingGroupComposition.nameBaseFromMembers(membersNamed(['Shelf']))).toBe(
      `Shelf ${OUTLINER_NAMING_GROUP_FALLBACK_BASE}`,
    );
  });

  it('lists two or three kinds, most common first', () => {
    expect(OutlinerNamingGroupComposition.nameBaseFromMembers(membersNamed(['Light', 'Box', 'Box']))).toBe(
      'Box x2 + Light',
    );
    expect(OutlinerNamingGroupComposition.nameBaseFromMembers(membersNamed(['Light', 'Box', 'Ramp']))).toBe(
      'Light + Box + Ramp',
    );
  });

  it('counts the kinds beyond the two most common', () => {
    const members = membersNamed(['Box', 'Box', 'Light', 'Light', 'Ramp', 'Cylinder', 'Wedge']);
    expect(OutlinerNamingGroupComposition.nameBaseFromMembers(members)).toBe('Box x2 + Light x2 + 3 more');
  });

  it('falls back to the plain group name when nothing is named', () => {
    expect(OutlinerNamingGroupComposition.nameBaseFromMembers([])).toBe(OUTLINER_NAMING_GROUP_FALLBACK_BASE);
    const unnamed = [new THREE.Object3D(), new THREE.Object3D()];
    expect(OutlinerNamingGroupComposition.nameBaseFromMembers(unnamed)).toBe(
      `${OUTLINER_NAMING_GROUP_FALLBACK_BASE} x2`,
    );
  });
});
