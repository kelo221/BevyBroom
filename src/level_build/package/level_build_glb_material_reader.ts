import { MATERIAL_IDENTITY_EXPORT_EXTRAS_KEY } from '@/materials/identity/material_identity.js';

/** Byte offset of the first chunk of a binary glTF file. */
const GLB_FIRST_CHUNK_OFFSET = 12;

/** Chunk type of the JSON chunk ("JSON" in little-endian ASCII). */
const GLB_JSON_CHUNK_TYPE = 0x4e4f534a;

/** One material of a glTF document with optional extras. */
interface LevelBuildGltfMaterial {
  extras?: Record<string, unknown>;
}

/**
 * Reads the game material ids a binary glTF file references through its
 * material extras.
 *
 * @param glb Binary glTF bytes.
 * @returns Unique material ids, sorted; empty when the file has no JSON chunk.
 */
export function levelBuildGlbMaterialIdsRead(glb: Uint8Array): string[] {
  const document = levelBuildGlbJsonRead(glb);
  const materials = Array.isArray(document?.['materials']) ? (document['materials'] as LevelBuildGltfMaterial[]) : [];
  const identifiers = new Set<string>();
  for (const material of materials) {
    const identifier = material.extras?.[MATERIAL_IDENTITY_EXPORT_EXTRAS_KEY];
    if (typeof identifier === 'string' && identifier.length > 0) {
      identifiers.add(identifier);
    }
  }
  return [...identifiers].sort();
}

/**
 * Parses the JSON chunk of a binary glTF file.
 *
 * @param glb Binary glTF bytes.
 * @returns The glTF document, or null when the first chunk is not JSON.
 */
function levelBuildGlbJsonRead(glb: Uint8Array): Record<string, unknown> | null {
  if (glb.byteLength < GLB_FIRST_CHUNK_OFFSET + 8) {
    return null;
  }
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const chunkLength = view.getUint32(GLB_FIRST_CHUNK_OFFSET, true);
  if (view.getUint32(GLB_FIRST_CHUNK_OFFSET + 4, true) !== GLB_JSON_CHUNK_TYPE) {
    return null;
  }
  const jsonStart = GLB_FIRST_CHUNK_OFFSET + 8;
  const jsonText = new TextDecoder().decode(glb.subarray(jsonStart, jsonStart + chunkLength));
  return JSON.parse(jsonText) as Record<string, unknown>;
}
