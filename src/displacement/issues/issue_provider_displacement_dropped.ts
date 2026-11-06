import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProviderSolid } from '@/info_panel/issues/providers/issue_provider_solid.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { SolidModel } from '@/solid/model/solid_model.js';

/** Identifier of the dropped displacement check. */
export const ISSUE_PROVIDER_DISPLACEMENT_DROPPED_ID = 'displacement_dropped';

/**
 * Reports brush faces whose saved displacement was malformed and was dropped
 * while loading, so the face shows and exports as flat geometry.
 */
export class IssueProviderDisplacementDropped extends IssueProviderSolid {
  /** Creates the provider. */
  constructor() {
    super(ISSUE_PROVIDER_DISPLACEMENT_DROPPED_ID, 'Dropped displacements');
  }

  /** @inheritdoc */
  collect(worldGroup: THREE.Object3D): Issue[] {
    return this.solidModelsList(worldGroup).flatMap((model) =>
      model.getBrushes().flatMap((brush) => this.brushIssuesCreate(model, brush)),
    );
  }

  /**
   * Creates one issue per dropped displacement of a brush.
   *
   * @param model Solid model owning the brush.
   * @param brush Brush to check.
   * @returns Issues naming the brush and face.
   */
  private brushIssuesCreate(model: SolidModel, brush: SolidBrushInstance): Issue[] {
    return brush.faceDisplacementsDroppedRead().map((faceIndex) =>
      this.issueCreate({
        severity: 'warning',
        ...this.solidTargetRead(model, brush),
        description: `Malformed displacement on brush "${brush.name}" face ${faceIndex} was dropped; the face is flat`,
      }),
    );
  }
}
