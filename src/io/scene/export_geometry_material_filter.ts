import * as THREE from 'three';
import { materialIdentityRead } from '@/materials/identity/material_identity.js';

/**
 * Leaves the triangles of some materials out of an exported mesh, such as the
 * faces of tool textures that only the game's collision keeps.
 */
export class ExportGeometryMaterialFilter {
  /**
   * Returns a geometry without the draw groups whose material identity is
   * omitted.
   *
   * @param geometry Source geometry; not modified.
   * @param materials Material or materials of the mesh, by group material
   *   index.
   * @param isOmitted Returns true for material identities left out.
   * @returns The source geometry when nothing is omitted, a filtered copy
   *   otherwise, or null when every triangle is omitted.
   */
  static filter(
    geometry: THREE.BufferGeometry,
    materials: THREE.Material | THREE.Material[],
    isOmitted: (materialIdentifier: string) => boolean,
  ): THREE.BufferGeometry | null {
    const materialList = Array.isArray(materials) ? materials : [materials];
    const omittedSlots = new Set(
      materialList
        .map((material, slot) => (ExportGeometryMaterialFilter.omittedIs(material, isOmitted) ? slot : -1))
        .filter((slot) => slot >= 0),
    );
    if (omittedSlots.size === 0) {
      return geometry;
    }
    const groups = geometry.groups.length > 0 ? geometry.groups : [ExportGeometryMaterialFilter.wholeGroupOf(geometry)];
    const kept = groups.filter((group) => !omittedSlots.has(group.materialIndex ?? 0));
    return kept.length === 0 ? null : ExportGeometryMaterialFilter.groupsKeep(geometry, kept);
  }

  /**
   * Returns whether a material's identity is omitted.
   *
   * @param material Material.
   * @param isOmitted Omission test.
   * @returns True when omitted.
   */
  private static omittedIs(material: THREE.Material, isOmitted: (materialIdentifier: string) => boolean): boolean {
    const identifier = materialIdentityRead(material);
    return identifier !== null && isOmitted(identifier);
  }

  /**
   * Returns one group covering a whole geometry with material slot zero.
   *
   * @param geometry Geometry.
   * @returns Whole-geometry group.
   */
  private static wholeGroupOf(geometry: THREE.BufferGeometry): { start: number; count: number; materialIndex: number } {
    const count = geometry.getIndex()?.count ?? geometry.getAttribute('position').count;
    return { start: 0, count, materialIndex: 0 };
  }

  /**
   * Returns a copy of a geometry drawing only some of its groups.
   *
   * @param geometry Source geometry.
   * @param kept Groups to keep.
   * @returns Copy with a rebuilt index and groups.
   */
  private static groupsKeep(
    geometry: THREE.BufferGeometry,
    kept: readonly { start: number; count: number; materialIndex?: number | undefined }[],
  ): THREE.BufferGeometry {
    const copy = geometry.clone();
    const sourceIndex = geometry.getIndex();
    const indices: number[] = [];
    copy.clearGroups();
    for (const group of kept) {
      copy.addGroup(indices.length, group.count, group.materialIndex ?? 0);
      for (let corner = group.start; corner < group.start + group.count; corner++) {
        indices.push(sourceIndex ? sourceIndex.getX(corner) : corner);
      }
    }
    copy.setIndex(indices);
    return copy;
  }
}
