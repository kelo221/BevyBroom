import { detectGeometrySourceFromInstance, setGeometrySource } from '@/texture/uv/geometry_source.js';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { SKIP_FACE_PICK_USERDATA_KEY } from '@/solid/model/solid_brush_visual.js';
import { MODIFIER_STACK_USERDATA_KEY } from '@/modifier/volume/modifier_volume_record.js';
import {
  MODIFIER_VOLUME_BEVEL_EDGE_KEY,
  MODIFIER_VOLUME_BEVEL_USERDATA_KEY,
  MODIFIER_VOLUME_OUTLINE_KEY,
} from '@/modifier/volume/modifier_volume_bevel_keys.js';
import type { ModifierStackSettings } from './modifier_stack_types.js';
import { modifierStackSettingsNormalize } from './modifier_stack_settings.js';

/**
 * The single scene volume type. Its box selects authored brushes and its
 * ordered modifier stack turns them, or nothing, into derived brushes.
 */
export class ModifierVolume {
  /**
   * Returns whether an object is a modifier volume.
   *
   * @param object Candidate object.
   * @returns True when the object carries a modifier stack.
   */
  static isVolume(object: THREE.Object3D): boolean {
    return (
      object.userData[MODIFIER_VOLUME_BEVEL_USERDATA_KEY] === true &&
      object.userData[MODIFIER_STACK_USERDATA_KEY] !== undefined
    );
  }

  /**
   * Reads a detached, normalized copy of the stack.
   *
   * @param volume Modifier volume.
   * @returns Stack settings.
   */
  static read(volume: THREE.Object3D): ModifierStackSettings {
    const stored = volume.userData[MODIFIER_STACK_USERDATA_KEY] as Partial<ModifierStackSettings> | undefined;
    return modifierStackSettingsNormalize(structuredClone(stored ?? {}));
  }

  /**
   * Stores normalized stack settings.
   *
   * @param volume Modifier volume.
   * @param settings New settings.
   */
  static write(volume: THREE.Object3D, settings: Partial<ModifierStackSettings>): void {
    volume.userData[MODIFIER_STACK_USERDATA_KEY] = modifierStackSettingsNormalize(structuredClone(settings));
  }

  /**
   * Creates a volume around box geometry with its see-through material and
   * outline.
   *
   * @param settings Initial stack.
   * @param geometry Box geometry; a unit box when omitted.
   * @returns Unnamed volume mesh.
   */
  static create(settings: Partial<ModifierStackSettings>, geometry?: THREE.BufferGeometry): THREE.Mesh {
    const material = ModifierVolume.createMaterial(Theme.modifierVolumeColor);
    const mesh = new THREE.Mesh(geometry ?? new THREE.BoxGeometry(1, 1, 1), material);
    ModifierVolume.stamp(mesh, settings);
    return mesh;
  }

  /**
   * Turns a duplicated mesh into a volume like its source: the stack, the
   * volume markers and the outline, with the fill hidden until selected.
   *
   * @param source Source volume.
   * @param clone Duplicate mesh with copied geometry and material.
   */
  static copyOntoClone(source: THREE.Object3D, clone: THREE.Object3D): void {
    if (!ModifierVolume.isVolume(source) || !(clone instanceof THREE.Mesh)) return;
    ModifierVolume.stamp(clone, ModifierVolume.read(source));
    ModifierVolume.setFillVisible(clone, false);
  }

  /**
   * Marks a box mesh as a volume that face picking skips, records its geometry
   * source, stores the stack and adds the outline.
   *
   * @param mesh Box mesh with the volume material.
   * @param settings Stack to store.
   */
  private static stamp(mesh: THREE.Mesh, settings: Partial<ModifierStackSettings>): void {
    const source = detectGeometrySourceFromInstance(mesh.geometry);
    if (source) setGeometrySource(mesh, source);
    mesh.userData[MODIFIER_VOLUME_BEVEL_USERDATA_KEY] = true;
    mesh.userData[SKIP_FACE_PICK_USERDATA_KEY] = true;
    ModifierVolume.write(mesh, settings);
    ModifierVolume.outlineAdd(mesh, Theme.modifierVolumeColor);
  }

  /**
   * Shows or hides the translucent box fill of a volume. Like a brush hull, the
   * fill is drawn only while the node is selected; the outline always stays.
   *
   * @param volume Volume.
   * @param visible True to draw the translucent fill.
   */
  static setFillVisible(volume: THREE.Object3D, visible: boolean): void {
    if (!(volume instanceof THREE.Mesh) || !ModifierVolume.isVolume(volume)) return;
    const materials: THREE.Material[] = Array.isArray(volume.material) ? volume.material : [volume.material];
    for (const material of materials) material.visible = visible;
  }

  /**
   * Returns whether a volume currently draws its box fill.
   *
   * @param volume Volume.
   * @returns True when the translucent fill is drawn.
   */
  static isFillVisible(volume: THREE.Object3D): boolean {
    if (!(volume instanceof THREE.Mesh) || !ModifierVolume.isVolume(volume)) return false;
    const materials: THREE.Material[] = Array.isArray(volume.material) ? volume.material : [volume.material];
    return materials.some((material) => material.visible);
  }

  /**
   * Creates the translucent box material, hidden until the node is selected.
   *
   * @param color Box color.
   * @returns Basic material.
   */
  private static createMaterial(color: number): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
      visible: false,
    });
  }

  /**
   * Adds the non-pickable outline child.
   *
   * @param mesh Volume mesh.
   * @param color Outline color.
   */
  private static outlineAdd(mesh: THREE.Mesh, color: number): void {
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color }));
    line.userData[MODIFIER_VOLUME_BEVEL_EDGE_KEY] = true;
    line.userData[MODIFIER_VOLUME_OUTLINE_KEY] = true;
    line.raycast = () => undefined;
    mesh.add(line);
  }
}

/**
 * Finds the top of an object's parent chain.
 *
 * @param object Start object.
 * @returns Root object.
 */
export function modifierVolumeSceneRoot(object: THREE.Object3D): THREE.Object3D {
  let root = object;
  while (root.parent) root = root.parent;
  return root;
}

/**
 * Lists attached, visible, enabled volumes in a deterministic order.
 *
 * @param root Scene root.
 * @returns Volumes sorted by uuid.
 */
export function modifierVolumesActive(root: THREE.Object3D): THREE.Object3D[] {
  const output: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (ModifierVolume.isVolume(object) && modifierVolumeVisible(object) && ModifierVolume.read(object).enabled)
      output.push(object);
  });
  return output.sort((left, right) => left.uuid.localeCompare(right.uuid));
}

/**
 * Lists every attached volume, enabled or not.
 *
 * @param root Scene root.
 * @returns Volumes in traversal order.
 */
export function modifierVolumesAll(root: THREE.Object3D): THREE.Object3D[] {
  const output: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (ModifierVolume.isVolume(object)) output.push(object);
  });
  return output;
}

/**
 * Returns whether the volume and all its parents are visible.
 *
 * @param object Volume.
 * @returns True when nothing in the chain is hidden.
 */
export function modifierVolumeVisible(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}
