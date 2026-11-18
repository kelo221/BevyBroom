import type * as THREE from 'three';

/** Kind of authored geometry a grid conformance finding is about. */
export type GridConformanceGeometryKind = 'brush' | 'mesh';

/** One authored object whose world bounds have a corner off the minimum grid. */
export interface GridConformanceViolation {
  /** Identifier stable across scans: the brush id or the mesh uuid. */
  readonly key: string;
  /** Kind of geometry. */
  readonly kind: GridConformanceGeometryKind;
  /** Uuid of the scene object to select for the problem. */
  readonly objectUuid: string;
  /** Display name of the object. */
  readonly objectName: string;
  /** World bounds corner found off the grid. */
  readonly offGridPoint: THREE.Vector3;
}

/** One editable mesh object, which a brush could usually replace. */
export interface GridConformanceMeshObject {
  /** Uuid of the mesh object. */
  readonly objectUuid: string;
  /** Display name of the mesh object. */
  readonly objectName: string;
}
