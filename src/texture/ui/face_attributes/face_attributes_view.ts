import type { UvEditorTrsFieldState } from '@/texture/uv/face_texture_applier.js';

/** View that shows the shared face attribute values of the current selection. */
export interface FaceAttributesView {
  /**
   * Shows shared or mixed face attribute values.
   *
   * @param fields Per-field state where null means mixed.
   */
  setFromFieldState(fields: UvEditorTrsFieldState): void;
}
