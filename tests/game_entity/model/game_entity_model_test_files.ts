import * as THREE from 'three';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import type { ProjectFileReadResult } from '@/project/files/project_file_read_result.js';
import type { GameEntityModelReader } from '@/game_entity/model/game_entity_model_library.js';

/**
 * Builds the bytes of a binary glTF holding one box mesh.
 *
 * @param size Edge lengths of the box along x, y and z.
 * @returns Binary glTF bytes.
 */
export async function gameEntityModelTestGlbCreate(size: THREE.Vector3): Promise<ArrayBuffer> {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshStandardMaterial());
  group.add(mesh);
  return new GlbExporter().exportForFile(group);
}

/**
 * Creates a model reader serving files from a map and recording every read.
 *
 * @param files Base64 file bytes by path.
 * @returns Reader and the paths it was asked for.
 */
export function gameEntityModelTestReaderCreate(files: Map<string, string>): {
  reader: GameEntityModelReader;
  reads: string[];
} {
  const reads: string[] = [];
  const reader = async (path: string): Promise<ProjectFileReadResult> => {
    reads.push(path);
    const bytesBase64 = files.get(path);
    return bytesBase64 === undefined ? { ok: false, message: `No model ${path}` } : { ok: true, path, bytesBase64 };
  };
  return { reader, reads };
}

/**
 * Encodes bytes as base64 text.
 *
 * @param buffer Bytes to encode.
 * @returns Base64 text.
 */
export function gameEntityModelTestBase64(buffer: ArrayBuffer): string {
  return Buffer.from(new Uint8Array(buffer)).toString('base64');
}

/**
 * Returns the size of the bounds of an object's meshes in its parent's space.
 *
 * @param object Object to measure.
 * @returns Bounds size.
 */
export function gameEntityModelTestSizeOf(object: THREE.Object3D): THREE.Vector3 {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
}
