/**
 * Packs a glTF document into a binary glTF file with only a JSON chunk.
 *
 * @param document GlTF document.
 * @returns GLB bytes.
 */
export function levelBuildTestGlbFromDocument(document: Record<string, unknown>): Uint8Array {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(document));
  const paddedLength = Math.ceil(jsonBytes.length / 4) * 4;
  const glb = new Uint8Array(12 + 8 + paddedLength).fill(0x20, 20);
  const view = new DataView(glb.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, glb.byteLength, true);
  view.setUint32(12, paddedLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  glb.set(jsonBytes, 20);
  return glb;
}
