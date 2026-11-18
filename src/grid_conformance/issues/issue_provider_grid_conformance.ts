import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import { GRID_INTERVAL_MINIMUM } from '@/types/snap_presets.js';
import { gridConformancePointFormat } from '@/grid_conformance/grid_conformance_point_check.js';
import { GridConformanceScanner } from '@/grid_conformance/grid_conformance_scanner.js';
import type { GridConformanceViolation } from '@/grid_conformance/grid_conformance_violation.js';

/** Identifier of the off-grid geometry check. */
export const ISSUE_PROVIDER_GRID_CONFORMANCE_ID = 'grid_conformance';

/** Reports brushes and editable meshes whose bounds leave the minimum grid. */
export class IssueProviderGridConformance extends IssueProvider {
  private readonly scanner = new GridConformanceScanner();

  /** Creates the provider. */
  constructor() {
    super(ISSUE_PROVIDER_GRID_CONFORMANCE_ID, 'Off-grid geometry');
  }

  /** @inheritdoc */
  collect(worldGroup: THREE.Object3D): Issue[] {
    return this.scanner.violationsCollect(worldGroup).map((violation) => this.violationIssueCreate(violation));
  }

  /**
   * Turns one violation into a warning.
   *
   * @param violation Off-grid object.
   * @returns The issue.
   */
  private violationIssueCreate(violation: GridConformanceViolation): Issue {
    const kindLabel = violation.kind === 'brush' ? 'Brush' : 'Mesh';
    return this.issueCreate({
      severity: 'warning',
      objectUuid: violation.objectUuid,
      objectName: violation.objectName,
      description: `${kindLabel} bounds corner ${gridConformancePointFormat(violation.offGridPoint)} is off the ${GRID_INTERVAL_MINIMUM} grid`,
    });
  }
}
