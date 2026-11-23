import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { ToolClipPlane } from './tool_clip_plane.js';
import { ClipKeepMode } from './clip_keep_mode.js';
import { collectClipCutEdgeSegments } from './clip_plane_cut_edges.js';
import { buildClipPiecePreviews } from './clip_plane_half_preview.js';
import { ClipPlanePreviewMarkers } from './clip_plane_preview_markers.js';
import { ClipPlanePreviewArrows } from './clip_plane_preview_arrows.js';
import { ClipPlanePreviewSheet } from './clip_plane_preview_sheet.js';
import {
  CLIP_CONSTRUCTION_LINE_USERDATA_KEY,
  CLIP_CUT_EDGE_USERDATA_KEY,
  CLIP_PREVIEW_USERDATA_KEY,
} from './clip_plane_preview_keys.js';

export {
  CLIP_CONSTRUCTION_LINE_USERDATA_KEY,
  CLIP_CUT_EDGE_USERDATA_KEY,
  CLIP_PREVIEW_USERDATA_KEY,
} from './clip_plane_preview_keys.js';

/** Overlay render order for construction and cut lines. */
const CLIP_LINE_RENDER_ORDER = 1000;

/**
 * Clip preview: big screen-constant point markers, a construction line between
 * the points, a translucent sheet showing the plane, the cut outline, the
 * pieces the clip removes (red) or keeps as two (two colors), and arrows that
 * point from the cut into every piece that stays.
 */
export class ClipPlanePreview {
  private root: THREE.Group;

  /** Creates a preview group that should be added to the world or scene. */
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'clip_plane_preview';
    this.root.userData[CLIP_PREVIEW_USERDATA_KEY] = true;
  }

  /**
   * Returns the root group to attach to a scene.
   *
   * @returns Preview root group.
   */
  getRoot(): THREE.Group {
    return this.root;
  }

  /**
   * Syncs preview visuals from the clip tool. Rebuilds only when called (tool
   * changes, pointer moves, drags, selection) — never from the render loop.
   * Sheet, pieces and cut edges use the selected targets only.
   *
   * @param tool Clip plane tool providing points, plane and keep mode.
   * @param targetMeshes Selected meshes to preview-clip.
   * @param hoveredMarkerIndex Index of the placed point under the pointer, or
   *   null.
   */
  syncFromTool(
    tool: ToolClipPlane,
    targetMeshes: readonly THREE.Mesh[] = [],
    hoveredMarkerIndex: number | null = null,
  ): void {
    this.clearVisuals();
    if (!tool.isActive()) return;
    this.addAll(ClipPlanePreviewMarkers.markersBuild(tool.getPoints(), tool.hoverPointRead(), hoveredMarkerIndex));
    this.addConstructionPolyline(tool.previewPointsRead());
    const plane = tool.previewPlaneRead();
    if (!plane) return;
    const targetBounds = this.targetBoundsCompute(targetMeshes);
    this.addAll(ClipPlanePreviewSheet.sheetBuild(plane, targetBounds));
    const cutSegments = collectClipCutEdgeSegments(plane, targetMeshes);
    this.addCutSilhouette(cutSegments);
    this.addPiecePreviews(plane, targetMeshes, tool.keepModeRead());
    const arrowOrigin = this.arrowOriginCompute(plane, cutSegments, targetBounds, tool.previewPointsRead());
    this.addAll(ClipPlanePreviewArrows.arrowsBuild(arrowOrigin, plane.normal, tool.keepModeRead()));
  }

  /** Removes all preview children and disposes resources. */
  dispose(): void {
    this.clearVisuals();
    this.root.parent?.remove(this.root);
  }

  /**
   * Clears overlays (markers, lines, sheet, pieces, arrows). Never mutates
   * scene meshes.
   */
  private clearVisuals(): void {
    while (this.root.children.length > 0) {
      const child = this.root.children[0];
      if (!child) break;
      this.root.remove(child);
      this.disposeObject(child);
    }
  }

  /**
   * Adds preview objects to the root.
   *
   * @param objects Objects to add.
   */
  private addAll(objects: readonly THREE.Object3D[]): void {
    if (objects.length > 0) this.root.add(...objects);
  }

  /**
   * Computes the world bounds of all targets.
   *
   * @param targetMeshes Selected clip targets.
   * @returns World bounds (empty without targets).
   */
  private targetBoundsCompute(targetMeshes: readonly THREE.Mesh[]): THREE.Box3 {
    const bounds = new THREE.Box3();
    targetMeshes.forEach((mesh) => bounds.expandByObject(mesh));
    return bounds;
  }

  /**
   * Picks where the side arrows start: the middle of the cut outline, else the
   * target center on the plane, else the middle of the placement points.
   *
   * @param plane World clip plane.
   * @param cutSegments Interleaved cut edge endpoints.
   * @param targetBounds World bounds of the targets.
   * @param points Placement points including the pointer preview point.
   * @returns World point on the plane.
   */
  private arrowOriginCompute(
    plane: THREE.Plane,
    cutSegments: readonly THREE.Vector3[],
    targetBounds: THREE.Box3,
    points: readonly THREE.Vector3[],
  ): THREE.Vector3 {
    let center: THREE.Vector3;
    if (cutSegments.length >= 2) center = this.pointsAverage(cutSegments);
    else if (!targetBounds.isEmpty()) center = targetBounds.getCenter(new THREE.Vector3());
    else center = this.pointsAverage(points);
    return plane.projectPoint(center, new THREE.Vector3());
  }

  /**
   * Averages points.
   *
   * @param points Points to average.
   * @returns Average, or the origin for no points.
   */
  private pointsAverage(points: readonly THREE.Vector3[]): THREE.Vector3 {
    const center = new THREE.Vector3();
    points.forEach((point) => center.add(point));
    return points.length > 0 ? center.multiplyScalar(1 / points.length) : center;
  }

  /**
   * Draws a short construction polyline between placed points and the pointer
   * preview point.
   *
   * @param points Placement points.
   */
  private addConstructionPolyline(points: THREE.Vector3[]): void {
    if (points.length < 2) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: Theme.clipConstructionLineColor,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.8,
      toneMapped: false,
    });
    const line = new THREE.Line(geometry, material);
    line.userData[CLIP_PREVIEW_USERDATA_KEY] = true;
    line.userData[CLIP_CONSTRUCTION_LINE_USERDATA_KEY] = true;
    line.renderOrder = CLIP_LINE_RENDER_ORDER;
    line.frustumCulled = false;
    this.root.add(line);
  }

  /**
   * Draws plane∩mesh cut edges for selected targets (the cut outline).
   *
   * @param cutSegments Interleaved cut edge endpoints.
   */
  private addCutSilhouette(cutSegments: readonly THREE.Vector3[]): void {
    if (cutSegments.length < 2) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(cutSegments as THREE.Vector3[]);
    const material = new THREE.LineBasicMaterial({
      color: Theme.clipCutEdgeColor,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
      toneMapped: false,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.userData[CLIP_PREVIEW_USERDATA_KEY] = true;
    lines.userData[CLIP_CUT_EDGE_USERDATA_KEY] = true;
    lines.renderOrder = CLIP_LINE_RENDER_ORDER;
    lines.frustumCulled = false;
    this.root.add(lines);
  }

  /**
   * Adds the piece previews of every target. Source meshes stay visible —
   * previews never hide scene geometry.
   *
   * @param plane World clip plane.
   * @param targetMeshes Selected targets.
   * @param mode Which pieces the clip keeps.
   */
  private addPiecePreviews(plane: THREE.Plane, targetMeshes: readonly THREE.Mesh[], mode: ClipKeepMode): void {
    targetMeshes.forEach((target) => this.addAll(buildClipPiecePreviews(target, plane, mode)));
  }

  /**
   * Disposes geometries and materials on a preview object.
   *
   * @param object Object to dispose.
   */
  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (!material) return;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
        return;
      }
      material.dispose();
    });
  }
}
