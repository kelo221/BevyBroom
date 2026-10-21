import type * as THREE from 'three';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { bytesToBase64 } from '@/utils/utils_base64.js';

/**
 * Exports an editor world as the binary glTF the game preview loads: hidden
 * objects stay in the file, no profile conversion is applied because the game
 * uses the editor's axes and meters, maps of game materials are left out, and
 * every mesh carries lightmap UVs for baking. Rooms and portals are not written
 * because the game receives them with the authored state.
 *
 * @param worldGroup Editor world root.
 * @param isMaterialMapResolvedByGame Returns true for material identifiers the
 *   game resolves itself.
 * @returns Base64 text of the GLB file.
 */
export async function previewGeometryEncodeGlb(
  worldGroup: THREE.Group,
  isMaterialMapResolvedByGame: (materialIdentifier: string) => boolean,
): Promise<string> {
  const buffer = await new GlbExporter().export(worldGroup, null, {
    includeHiddenObjects: true,
    includeLightmapUvs: true,
    isMaterialMapResolvedByGame,
  });
  return bytesToBase64(buffer);
}
