import * as THREE from 'three';
import { MaterialColorNeutral } from '@/materials/material_color_neutral.js';
import {
  ENTITY_PICK_MESH_USERDATA_KEY,
  ENTITY_VISUAL_PART_USERDATA_KEY,
  ENTITY_VISUAL_PERSISTENT_USERDATA_KEY,
  entityPickMeshIs,
  entityVisualPartIs,
  entityVisualPersistentIs,
} from '@/entity/model/entity_owner_keys.js';

/** Look of one set of guide lines drawn under an entity owner. */
export interface EntityGuideLineStyle {
  readonly colorHex: number;
  readonly opacity: number;
  readonly dashed: boolean;
}

/** Dash and gap length of dashed guide lines in meters. */
const ENTITY_GUIDE_DASH_SIZE = 0.15;

/**
 * Shared building blocks for entity visuals: one clickable marker that keeps
 * its identity across refreshes, and non-pickable guide lines that are replaced
 * on every refresh.
 */
export class EntityVisualBuilder {
  /**
   * Returns the clickable marker mesh of an owner.
   *
   * @param owner Entity owner group.
   * @returns The marker mesh, or null before the first refresh.
   */
  static markerFind(owner: THREE.Object3D): THREE.Mesh | null {
    for (const child of owner.children) {
      if (child instanceof THREE.Mesh && entityPickMeshIs(child)) {
        return child;
      }
    }
    return null;
  }

  /**
   * Returns the owner's marker with the given geometry and name, creating it
   * when missing.
   *
   * @param owner Entity owner group.
   * @param geometry Marker geometry.
   * @param name Marker object name.
   * @returns The marker mesh.
   */
  static markerEnsure(owner: THREE.Object3D, geometry: THREE.BufferGeometry, name: string): THREE.Mesh {
    const existing = EntityVisualBuilder.markerFind(owner);
    if (existing) {
      existing.geometry = geometry;
      existing.name = name;
      return existing;
    }
    const marker = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: MaterialColorNeutral.white }));
    marker.name = name;
    EntityVisualBuilder.partFlag(marker);
    marker.userData[ENTITY_PICK_MESH_USERDATA_KEY] = true;
    owner.add(marker);
    return marker;
  }

  /**
   * Tints a marker and fades it when the entity is disabled.
   *
   * @param marker Marker mesh.
   * @param colorHex Marker color.
   * @param opacity Marker opacity; values below one make it transparent.
   */
  static markerTint(marker: THREE.Mesh, colorHex: number, opacity: number): void {
    const material = marker.material;
    if (!(material instanceof THREE.MeshBasicMaterial)) {
      return;
    }
    material.color.setHex(colorHex);
    material.opacity = opacity;
    material.transparent = opacity < 1;
    material.side = THREE.DoubleSide;
  }

  /**
   * Removes and disposes every visual part except the marker and the other
   * persistent parts.
   *
   * @param owner Entity owner group.
   */
  static guidesRemove(owner: THREE.Object3D): void {
    const stale = owner.children.filter(
      (child) => entityVisualPartIs(child) && !entityPickMeshIs(child) && !entityVisualPersistentIs(child),
    );
    for (const part of stale) {
      owner.remove(part);
      EntityVisualBuilder.lineDispose(part);
    }
  }

  /**
   * Strips an owner's visuals down to a plain marker, so the visuals of another
   * entity kind can be built on it. The marker object itself stays, so a
   * selection holding it stays valid.
   *
   * @param owner Entity owner group.
   */
  static visualsResetForKindChange(owner: THREE.Object3D): void {
    EntityVisualBuilder.guidesRemove(owner);
    const marker = EntityVisualBuilder.markerFind(owner);
    const persistentParts = owner.children.filter((child) => entityVisualPartIs(child) && child !== marker);
    for (const part of persistentParts) {
      owner.remove(part);
      EntityVisualBuilder.partMaterialsDispose(part);
    }
    if (marker) {
      EntityVisualBuilder.markerReset(marker);
    }
  }

  /**
   * Returns a marker to the state of a newly created one: no child parts, unit
   * scale, only the marker flags and a plain white material.
   *
   * @param marker Marker mesh.
   */
  private static markerReset(marker: THREE.Mesh): void {
    for (const child of [...marker.children]) {
      marker.remove(child);
      EntityVisualBuilder.partMaterialsDispose(child);
    }
    marker.scale.set(1, 1, 1);
    marker.userData = {};
    EntityVisualBuilder.partFlag(marker);
    marker.userData[ENTITY_PICK_MESH_USERDATA_KEY] = true;
    EntityVisualBuilder.partMaterialsDispose(marker);
    marker.material = new THREE.MeshBasicMaterial({ color: MaterialColorNeutral.white });
  }

  /**
   * Disposes the materials of a removed persistent part. Persistent parts share
   * their geometries, so those are kept.
   *
   * @param part Removed part.
   */
  private static partMaterialsDispose(part: THREE.Object3D): void {
    if (!(part instanceof THREE.Mesh || part instanceof THREE.LineSegments)) {
      return;
    }
    const materials: THREE.Material[] = Array.isArray(part.material) ? part.material : [part.material];
    materials.forEach((material) => material.dispose());
  }

  /**
   * Creates non-pickable guide line segments flagged as an entity visual part.
   *
   * @param points Segment endpoint pairs.
   * @param style Color, opacity and dash style.
   * @param name Object name.
   * @returns Line segments object.
   */
  static linesCreate(points: readonly THREE.Vector3[], style: EntityGuideLineStyle, name: string): THREE.LineSegments {
    const geometry = new THREE.BufferGeometry().setFromPoints([...points]);
    const lines = new THREE.LineSegments(geometry, EntityVisualBuilder.lineMaterialCreate(style));
    if (style.dashed) {
      lines.computeLineDistances();
    }
    lines.name = name;
    lines.raycast = () => {};
    EntityVisualBuilder.partFlag(lines);
    return lines;
  }

  /**
   * Creates the material of guide lines.
   *
   * @param style Color, opacity and dash style.
   * @returns Line material.
   */
  private static lineMaterialCreate(style: EntityGuideLineStyle): THREE.LineBasicMaterial | THREE.LineDashedMaterial {
    const parameters = { color: style.colorHex, transparent: true, opacity: style.opacity, depthWrite: false };
    if (style.dashed) {
      return new THREE.LineDashedMaterial({
        ...parameters,
        dashSize: ENTITY_GUIDE_DASH_SIZE,
        gapSize: ENTITY_GUIDE_DASH_SIZE,
      });
    }
    return new THREE.LineBasicMaterial(parameters);
  }

  /**
   * Marks an object as an entity visual part.
   *
   * @param object Visual object.
   */
  static partFlag(object: THREE.Object3D): void {
    object.userData[ENTITY_VISUAL_PART_USERDATA_KEY] = true;
  }

  /**
   * Marks an object as an entity visual part that refreshes keep.
   *
   * @param object Visual object.
   */
  static partPersistentFlag(object: THREE.Object3D): void {
    EntityVisualBuilder.partFlag(object);
    object.userData[ENTITY_VISUAL_PERSISTENT_USERDATA_KEY] = true;
  }

  /**
   * Disposes the geometry and material of a removed line part.
   *
   * @param part Removed part.
   */
  private static lineDispose(part: THREE.Object3D): void {
    if (!(part instanceof THREE.LineSegments)) {
      return;
    }
    part.geometry.dispose();
    const material = part.material;
    if (material instanceof THREE.Material) {
      material.dispose();
    }
  }
}
