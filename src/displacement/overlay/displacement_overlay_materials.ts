import * as THREE from 'three';
import { Theme } from '@/theme.js';

/** Color of the displacement grid wireframe. */
const DISPLACEMENT_OVERLAY_GRID_COLOR = Theme.displacementOverlayGridColor;

/** Dash length of a cell diagonal, as a share of the diagonal's length. */
export const DISPLACEMENT_OVERLAY_DIAGONAL_DASH_SHARE = 0.125;

/** Polygon offset pulling the alpha tint in front of the displacement surface. */
const DISPLACEMENT_OVERLAY_TINT_POLYGON_OFFSET = -1;

/** Materials shared by every displacement overlay of one presenter. */
export class DisplacementOverlayMaterials {
  /** Solid white lines along the grid rows and columns. */
  readonly gridLine: THREE.LineBasicMaterial;
  /** Dashed white lines along the cell diagonals. */
  readonly gridDiagonal: THREE.LineDashedMaterial;
  /** Grayscale vertex color fill showing painted alphas. */
  readonly alphaTint: THREE.MeshBasicMaterial;

  /** Creates the shared overlay materials. */
  constructor() {
    this.gridLine = new THREE.LineBasicMaterial({ color: DISPLACEMENT_OVERLAY_GRID_COLOR, toneMapped: false });
    this.gridDiagonal = new THREE.LineDashedMaterial({
      color: DISPLACEMENT_OVERLAY_GRID_COLOR,
      dashSize: DISPLACEMENT_OVERLAY_DIAGONAL_DASH_SHARE,
      gapSize: DISPLACEMENT_OVERLAY_DIAGONAL_DASH_SHARE,
      toneMapped: false,
    });
    this.alphaTint = new THREE.MeshBasicMaterial({
      vertexColors: true,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: DISPLACEMENT_OVERLAY_TINT_POLYGON_OFFSET,
      polygonOffsetUnits: DISPLACEMENT_OVERLAY_TINT_POLYGON_OFFSET,
    });
  }

  /** Releases every shared material. */
  dispose(): void {
    this.gridLine.dispose();
    this.gridDiagonal.dispose();
    this.alphaTint.dispose();
  }
}
