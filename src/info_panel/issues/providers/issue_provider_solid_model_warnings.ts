import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProviderSolid } from '@/info_panel/issues/providers/issue_provider_solid.js';
import type { SolidModel } from '@/solid/model/solid_model.js';
import { solidModelWarningsCollect, type SolidModelWarning } from '@/solid/validation/solid_model_warnings.js';

/** Identifier of the solid model warning check. */
export const ISSUE_PROVIDER_SOLID_MODEL_WARNINGS_ID = 'solid_model_warnings';

/**
 * Reports empty solid models, models with an inverted world and subtractive
 * brushes that overlap no additive brush.
 */
export class IssueProviderSolidModelWarnings extends IssueProviderSolid {
  /** Creates the provider. */
  constructor() {
    super(ISSUE_PROVIDER_SOLID_MODEL_WARNINGS_ID, 'Solid model warnings');
  }

  /** @inheritdoc */
  collect(worldGroup: THREE.Object3D): Issue[] {
    return this.solidModelsList(worldGroup).flatMap((model) =>
      solidModelWarningsCollect(model).map((warning) => this.warningIssueCreate(model, warning)),
    );
  }

  /**
   * Turns a solid model warning into an issue.
   *
   * @param model Solid model warned about.
   * @param warning The warning.
   * @returns The issue.
   */
  private warningIssueCreate(model: SolidModel, warning: SolidModelWarning): Issue {
    return this.issueCreate({
      severity: 'warning',
      ...this.solidTargetRead(model, warning.brush),
      description: warning.text,
    });
  }
}
