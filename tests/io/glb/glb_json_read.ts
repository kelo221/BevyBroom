/** Minimal glTF JSON shape read by export tests. */
export interface ExportedGltfJson {
  nodes?: Array<{
    name?: string;
    extras?: Record<string, unknown>;
    scale?: [number, number, number];
    mesh?: number;
    children?: number[];
  }>;
  meshes?: Array<{ primitives: Array<{ attributes: Record<string, number> }> }>;
  materials?: Array<{ extras?: Record<string, unknown>; pbrMetallicRoughness?: { baseColorTexture?: unknown } }>;
}

/**
 * Reads the JSON chunk of a binary glTF file.
 *
 * @param buffer GLB bytes.
 * @returns Parsed glTF JSON.
 */
export function glbJsonRead(buffer: ArrayBuffer): ExportedGltfJson {
  const view = new DataView(buffer);
  const jsonLength = view.getUint32(12, true);
  const jsonBytes = new Uint8Array(buffer, 20, jsonLength);
  return JSON.parse(new TextDecoder().decode(jsonBytes)) as ExportedGltfJson;
}
