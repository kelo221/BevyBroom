import type { FaceAttributesEditorHandlers } from '@/texture/ui/face_attributes/face_attributes_editor.js';
import type { FaceAttributesMaterialDescriber } from '@/texture/ui/face_attributes/face_attributes_material_row.js';
import type { DialogTextureReplaceMaterial } from '@/texture/ui/texture_replace/dialog_texture_replace.js';
import type { SurfaceUvVectors2x3 } from '@/texture/uv_matrix/surface_uv_matrix_vectors.js';

/** Extended handlers for the floating Hammer++ Face Edit Sheet. */
export interface DialogFaceEditSheetHandlers extends FaceAttributesEditorHandlers {
  /** Shifts UVs by whole-tile increments. */
  onShiftFullTile?: (tilesU: number, tilesV: number) => void;
  /** Sets the 2×3 U and V projection axis direction vectors. */
  onSetVectors2x3?: (vectors: SurfaceUvVectors2x3) => void;
  /** Selects all faces in the map using the current texture. */
  onMarkFacesWithTexture?: (textureId: string) => void;
  /** Opens the texture browser. */
  onBrowseMaterial?: () => void;
  /** Replaces the current texture across matching faces. */
  onReplaceTexture?: (oldTextureId: string) => void;
  /** Applies a texture to the selected faces or objects. */
  onApplyTexture?: (textureId: string) => void;
  /** Lists the known textures offered by the current texture list. */
  texturesList?: () => readonly DialogTextureReplaceMaterial[];
  /** Looks up the name, preview and size of a texture. */
  textureDescribe?: FaceAttributesMaterialDescriber;
}
