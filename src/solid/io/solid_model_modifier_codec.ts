import * as THREE from 'three';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import type { ModifierStackSettings } from '@/modifier/stack/modifier_stack_types.js';

/** A modifier volume saved inside a solid model hierarchy. */
export interface SerializedSolidTreeModifierNode {
  kind: 'modifier';
  /** Uuid of the volume, kept so references to it survive a reload. */
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  visible: boolean;
  /** Edge lengths of the volume's box geometry. */
  size: { x: number; y: number; z: number };
  settings: ModifierStackSettings;
}

/**
 * Captures a modifier volume without its derived geometry or editor helpers.
 *
 * @param volume Modifier volume mesh.
 * @returns Hierarchy node holding the volume.
 */
export function solidModelModifierEncode(volume: THREE.Object3D): SerializedSolidTreeModifierNode {
  return {
    kind: 'modifier',
    id: volume.uuid,
    name: volume.name,
    position: { x: volume.position.x, y: volume.position.y, z: volume.position.z },
    rotation: { x: volume.rotation.x, y: volume.rotation.y, z: volume.rotation.z },
    scale: { x: volume.scale.x, y: volume.scale.y, z: volume.scale.z },
    visible: volume.visible,
    size: solidModelModifierSizeRead(volume),
    settings: ModifierVolume.read(volume),
  };
}

/**
 * Restores a modifier volume with its uuid, transform, box and stack.
 *
 * @param node Saved hierarchy node.
 * @returns Detached volume mesh.
 */
export function solidModelModifierDecode(node: SerializedSolidTreeModifierNode): THREE.Mesh {
  const size = node.size ?? { x: 1, y: 1, z: 1 };
  const volume = ModifierVolume.create(node.settings, new THREE.BoxGeometry(size.x, size.y, size.z));
  volume.uuid = node.id;
  volume.name = node.name;
  volume.position.set(node.position.x, node.position.y, node.position.z);
  volume.rotation.set(node.rotation.x, node.rotation.y, node.rotation.z, 'XYZ');
  volume.scale.set(node.scale.x, node.scale.y, node.scale.z);
  volume.visible = node.visible;
  return volume;
}

/**
 * Measures the box geometry of a volume in its own space.
 *
 * @param volume Modifier volume mesh.
 * @returns Edge lengths; a unit box when the volume has no geometry.
 */
function solidModelModifierSizeRead(volume: THREE.Object3D): { x: number; y: number; z: number } {
  if (!(volume instanceof THREE.Mesh)) return { x: 1, y: 1, z: 1 };
  const geometry = volume.geometry as THREE.BufferGeometry;
  geometry.computeBoundingBox();
  const size = (geometry.boundingBox ?? new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1))).getSize(
    new THREE.Vector3(),
  );
  return { x: size.x, y: size.y, z: size.z };
}
