import type * as THREE from 'three';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SelectionQuery, type SelectionQueryId } from './selection_query.js';

/** Selects every solid brush that uses a texture of a selected brush face. */
export class SelectionQueryByMaterial extends SelectionQuery {
  readonly id: SelectionQueryId = 'by_material';
  readonly label = 'By Material';

  /**
   * Returns the brush candidates sharing a face texture with the selection.
   *
   * @param candidates Selectable meshes of the scene.
   * @param selected Currently selected meshes.
   * @returns Brushes using any selected texture, selected ones included.
   */
  select(candidates: readonly THREE.Mesh[], selected: readonly THREE.Mesh[]): THREE.Mesh[] {
    const textureIds = new Set(selected.flatMap((mesh) => this.meshTextureIds(mesh)));
    return candidates.filter((candidate) => this.meshTextureIds(candidate).some((id) => textureIds.has(id)));
  }

  /**
   * Lists the face texture ids of a brush mesh.
   *
   * @param mesh Brush preview mesh.
   * @returns Texture id per face, empty for meshes that are no brush.
   */
  private meshTextureIds(mesh: THREE.Mesh): string[] {
    const brush = SolidModel.fromObject(mesh)?.findBrushByMesh(mesh);
    if (!brush) {
      return [];
    }
    return brush.brush.faces.map((_face, faceIndex) => brush.getSurfaceTextureId(faceIndex));
  }
}
