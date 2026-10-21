import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProviderSolid } from '@/info_panel/issues/providers/issue_provider_solid.js';
import { SolidBrushValidator } from '@/solid/brush/solid_brush_validator.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { SolidModel } from '@/solid/model/solid_model.js';

/** Identifier of the invalid brush check. */
export const ISSUE_PROVIDER_SOLID_BRUSH_INVALID_ID = 'solid_brush_invalid';

/** Reports solid brushes whose topology or convexity is broken. */
export class IssueProviderSolidBrushInvalid extends IssueProviderSolid {
  /** Creates the provider. */
  constructor() {
    super(ISSUE_PROVIDER_SOLID_BRUSH_INVALID_ID, 'Invalid brushes');
  }

  /** @inheritdoc */
  collect(worldGroup: THREE.Object3D): Issue[] {
    const issues: Issue[] = [];
    for (const model of this.solidModelsList(worldGroup)) {
      for (const brush of model.getBrushes()) {
        const issue = this.brushIssueCreate(model, brush);
        if (issue) {
          issues.push(issue);
        }
      }
    }
    return issues;
  }

  /**
   * Validates one brush.
   *
   * @param model Solid model owning the brush.
   * @param brush Brush to validate.
   * @returns The issue of an invalid brush, or null when it is valid.
   */
  private brushIssueCreate(model: SolidModel, brush: SolidBrushInstance): Issue | null {
    const validation = SolidBrushValidator.validate(brush.brush);
    if (validation.valid) {
      return null;
    }
    return this.issueCreate({
      severity: 'error',
      ...this.solidTargetRead(model, brush),
      description: `Invalid brush: ${validation.errors.join('; ')}`,
    });
  }
}
