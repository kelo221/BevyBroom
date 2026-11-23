import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { CLIP_PREVIEW_USERDATA_KEY } from './clip_plane_preview_keys.js';
import { clipPreviewDepthTestPerPaneApply } from './clip_plane_preview_render_hooks.js';

/** UserData key marking the clip plane sheet fill. */
export const CLIP_PLANE_SHEET_USERDATA_KEY = 'isClipPlaneSheet';

/** UserData key marking the clip plane sheet outline. */
export const CLIP_PLANE_SHEET_OUTLINE_USERDATA_KEY = 'isClipPlaneSheetOutline';

/** Share of the cut extent the sheet reaches past the brush on every side. */
const CLIP_PLANE_SHEET_MARGIN_SHARE = 0.2;

/** Smallest distance in meters the sheet reaches past the brush. */
const CLIP_PLANE_SHEET_MIN_MARGIN = 0.125;

/** Opacity of the sheet fill. */
const CLIP_PLANE_SHEET_OPACITY = 0.16;

/** Draw order of the sheet fill and outline. */
const CLIP_PLANE_SHEET_RENDER_ORDER = 990;

/** Rectangle on the plane: its center and two in-plane half axes. */
export interface ClipPlaneSheetRectangle {
  readonly center: THREE.Vector3;
  readonly halfAxisU: THREE.Vector3;
  readonly halfAxisV: THREE.Vector3;
}

/**
 * Builds the translucent sheet that shows the clip plane itself, sized to the
 * selection plus a margin so it visibly passes through the brushes. Its edges
 * follow the world axis lying most in the plane, so in a 2D view whose axis
 * lies in the plane the sheet is an edge-on line across the brush.
 */
export class ClipPlanePreviewSheet {
  /**
   * Builds the sheet fill and outline for a plane through target bounds.
   *
   * @param plane World clip plane.
   * @param targetBounds World bounds of the clip targets.
   * @returns Sheet objects, or an empty list for empty bounds.
   */
  static sheetBuild(plane: THREE.Plane, targetBounds: THREE.Box3): THREE.Object3D[] {
    const rectangle = ClipPlanePreviewSheet.rectangleCompute(plane, targetBounds);
    if (!rectangle) return [];
    const corners = ClipPlanePreviewSheet.cornersCompute(rectangle);
    return [ClipPlanePreviewSheet.fillBuild(corners), ClipPlanePreviewSheet.outlineBuild(corners)];
  }

  /**
   * Computes the sheet rectangle: target bounds projected onto the plane and
   * grown by a margin.
   *
   * @param plane World clip plane.
   * @param targetBounds World bounds of the clip targets.
   * @returns Rectangle, or null for empty bounds.
   */
  static rectangleCompute(plane: THREE.Plane, targetBounds: THREE.Box3): ClipPlaneSheetRectangle | null {
    if (targetBounds.isEmpty()) return null;
    const axisV = ClipPlanePreviewSheet.inPlaneAxisPick(plane.normal);
    const axisU = new THREE.Vector3().crossVectors(axisV, plane.normal).normalize();
    const origin = plane.projectPoint(targetBounds.getCenter(new THREE.Vector3()), new THREE.Vector3());
    const extentU = ClipPlanePreviewSheet.boundsExtentAlong(targetBounds, origin, axisU);
    const extentV = ClipPlanePreviewSheet.boundsExtentAlong(targetBounds, origin, axisV);
    const margin = Math.max(
      CLIP_PLANE_SHEET_MIN_MARGIN,
      Math.max(extentU.max - extentU.min, extentV.max - extentV.min) * CLIP_PLANE_SHEET_MARGIN_SHARE,
    );
    const center = origin
      .clone()
      .addScaledVector(axisU, (extentU.min + extentU.max) * 0.5)
      .addScaledVector(axisV, (extentV.min + extentV.max) * 0.5);
    const halfAxisU = axisU.clone().multiplyScalar((extentU.max - extentU.min) * 0.5 + margin);
    const halfAxisV = axisV.clone().multiplyScalar((extentV.max - extentV.min) * 0.5 + margin);
    return { center, halfAxisU, halfAxisV };
  }

  /**
   * Picks the unit in-plane direction closest to a world axis: the world axis
   * least aligned with the normal, projected onto the plane.
   *
   * @param normal Unit plane normal.
   * @returns Unit in-plane axis.
   */
  private static inPlaneAxisPick(normal: THREE.Vector3): THREE.Vector3 {
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    const alignment = (axis: THREE.Vector3): number => Math.abs(axis.dot(normal));
    const leastAligned = axes.reduce((best, axis) => (alignment(axis) < alignment(best) ? axis : best));
    return leastAligned.addScaledVector(normal, -leastAligned.dot(normal)).normalize();
  }

  /**
   * Measures the range the eight bounds corners cover along an axis, relative
   * to an origin.
   *
   * @param bounds World bounds.
   * @param origin Origin on the plane.
   * @param axis Unit axis.
   * @returns Smallest and largest offset.
   */
  private static boundsExtentAlong(
    bounds: THREE.Box3,
    origin: THREE.Vector3,
    axis: THREE.Vector3,
  ): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    const corner = new THREE.Vector3();
    for (let cornerIndex = 0; cornerIndex < 8; cornerIndex++) {
      corner.set(
        cornerIndex & 1 ? bounds.max.x : bounds.min.x,
        cornerIndex & 2 ? bounds.max.y : bounds.min.y,
        cornerIndex & 4 ? bounds.max.z : bounds.min.z,
      );
      const offset = corner.sub(origin).dot(axis);
      min = Math.min(min, offset);
      max = Math.max(max, offset);
    }
    return { min, max };
  }

  /**
   * Returns the four rectangle corners in winding order.
   *
   * @param rectangle Sheet rectangle.
   * @returns Corner points.
   */
  private static cornersCompute(rectangle: ClipPlaneSheetRectangle): THREE.Vector3[] {
    const { center, halfAxisU, halfAxisV } = rectangle;
    return [
      center.clone().sub(halfAxisU).sub(halfAxisV),
      center.clone().add(halfAxisU).sub(halfAxisV),
      center.clone().add(halfAxisU).add(halfAxisV),
      center.clone().sub(halfAxisU).add(halfAxisV),
    ];
  }

  /**
   * Builds the translucent two-sided sheet fill.
   *
   * @param corners Rectangle corners in winding order.
   * @returns Fill mesh.
   */
  private static fillBuild(corners: readonly THREE.Vector3[]): THREE.Mesh {
    const geometry = new THREE.BufferGeometry().setFromPoints(corners as THREE.Vector3[]);
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const material = new THREE.MeshBasicMaterial({
      color: Theme.clipPlaneSheetColor,
      transparent: true,
      opacity: CLIP_PLANE_SHEET_OPACITY,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    material.toneMapped = false;
    const fill = new THREE.Mesh(geometry, material);
    ClipPlanePreviewSheet.overlayTag(fill, CLIP_PLANE_SHEET_USERDATA_KEY);
    return fill;
  }

  /**
   * Builds the sheet outline.
   *
   * @param corners Rectangle corners in winding order.
   * @returns Outline loop.
   */
  private static outlineBuild(corners: readonly THREE.Vector3[]): THREE.LineLoop {
    const geometry = new THREE.BufferGeometry().setFromPoints(corners as THREE.Vector3[]);
    const material = new THREE.LineBasicMaterial({
      color: Theme.clipCutEdgeColor,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    material.toneMapped = false;
    const outline = new THREE.LineLoop(geometry, material);
    ClipPlanePreviewSheet.overlayTag(outline, CLIP_PLANE_SHEET_OUTLINE_USERDATA_KEY);
    return outline;
  }

  /**
   * Marks a sheet object as clip preview overlay drawn per pane.
   *
   * @param object Sheet fill or outline.
   * @param kindKey UserData kind flag.
   */
  private static overlayTag(object: THREE.Mesh | THREE.LineLoop, kindKey: string): void {
    object.userData[CLIP_PREVIEW_USERDATA_KEY] = true;
    object.userData[kindKey] = true;
    object.renderOrder = CLIP_PLANE_SHEET_RENDER_ORDER;
    object.frustumCulled = false;
    object.raycast = () => undefined;
    clipPreviewDepthTestPerPaneApply(object);
  }
}
