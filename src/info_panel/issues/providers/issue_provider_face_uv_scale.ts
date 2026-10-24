import * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import { getFaceTextureMaps } from '@/texture/uv/face_texture_storage.js';
import { SURFACE_UV_MIN_SCALE } from '@/texture/uv_matrix/surface_uv_matrix.js';

/** Identifier of the face UV scale check. */
export const ISSUE_PROVIDER_FACE_UV_SCALE_ID = 'face_uv_scale';

/** Scale magnitude below which a face UV axis counts as collapsed. */
const FACE_UV_SCALE_MIN = SURFACE_UV_MIN_SCALE;

/** Reports faces whose stored UV matrix has a zero or collapsed scale axis. */
export class IssueProviderFaceUvScale extends IssueProvider {
  /** Creates the provider. */
  constructor() {
    super(ISSUE_PROVIDER_FACE_UV_SCALE_ID, 'Face UV scale');
  }

  /** @inheritdoc */
  collect(worldGroup: THREE.Object3D): Issue[] {
    const issues: Issue[] = [];
    worldGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        issues.push(...this.meshIssuesCollect(child));
      }
    });
    return issues;
  }

  /**
   * Collects the collapsed-scale issues of one mesh's stored face maps.
   *
   * @param mesh Candidate mesh.
   * @returns Issues of the mesh's face regions.
   */
  private meshIssuesCollect(mesh: THREE.Mesh): Issue[] {
    return getFaceTextureMaps(mesh)
      .map((entry, entryIndex) => this.entryIssueCreate(mesh, entry.mapping, entryIndex))
      .filter((issue): issue is Issue => issue !== null);
  }

  /**
   * Creates the issue of one face region whose UV scale collapsed.
   *
   * @param mesh Mesh owning the region.
   * @param mapping Stored mapping of the region.
   * @param entryIndex Index of the region entry.
   * @returns Issue, or null when the mapping scale is usable.
   */
  private entryIssueCreate(
    mesh: THREE.Mesh,
    mapping: { uv: { u: { x: number; y: number; z: number }; v: { x: number; y: number; z: number } } },
    entryIndex: number,
  ): Issue | null {
    const scaleU = Math.hypot(mapping.uv.u.x, mapping.uv.u.y, mapping.uv.u.z);
    const scaleV = Math.hypot(mapping.uv.v.x, mapping.uv.v.y, mapping.uv.v.z);
    const collapsedAxes = this.collapsedAxisNames(scaleU, scaleV);
    if (collapsedAxes.length === 0) {
      return null;
    }
    return this.issueCreate({
      severity: 'warning',
      objectUuid: mesh.uuid,
      objectName: mesh.name || mesh.uuid,
      description: `Face region ${entryIndex}: ${collapsedAxes.join(' and ')} UV scale is zero or collapsed`,
    });
  }

  /**
   * Lists the axis names whose scale magnitude collapsed.
   *
   * @param scaleU U axis scale magnitude.
   * @param scaleV V axis scale magnitude.
   * @returns Collapsed axis names.
   */
  private collapsedAxisNames(scaleU: number, scaleV: number): string[] {
    const names: string[] = [];
    if (!Number.isFinite(scaleU) || scaleU < FACE_UV_SCALE_MIN) {
      names.push('U');
    }
    if (!Number.isFinite(scaleV) || scaleV < FACE_UV_SCALE_MIN) {
      names.push('V');
    }
    return names;
  }
}
