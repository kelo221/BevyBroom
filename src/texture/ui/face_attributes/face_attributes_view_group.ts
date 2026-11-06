import type { UvEditorTrsFieldState } from '@/texture/uv/face_texture_applier.js';
import type { FaceAttributesView } from './face_attributes_view.js';

/** Face attributes view that shows the same values in several views. */
export class FaceAttributesViewGroup implements FaceAttributesView {
  private readonly views: readonly FaceAttributesView[];

  /**
   * Creates a view group.
   *
   * @param views Views that receive every value update.
   */
  constructor(views: readonly FaceAttributesView[]) {
    this.views = [...views];
  }

  /**
   * Shows shared or mixed face attribute values in every view.
   *
   * @param fields Per-field state where null means mixed.
   */
  setFromFieldState(fields: UvEditorTrsFieldState): void {
    this.views.forEach((view) => view.setFromFieldState(fields));
  }
}
