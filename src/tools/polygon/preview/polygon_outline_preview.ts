import * as THREE from 'three';
import { Theme } from '@/theme.js';
import type { ShapeDrawPreviewHost } from '@/tools/shape_draw/shape_draw_preview.js';
import type { StatePolygonTool } from '../state_polygon_tool.js';
import { PolygonOutlinePreviewGeometry } from './polygon_outline_preview_geometry.js';

/** UserData key marking the editor-only Polygon outline preview. */
export const POLYGON_OUTLINE_PREVIEW_USERDATA_KEY = 'isPolygonOutlinePreview';

/** Render order that keeps the outline preview above scene geometry. */
const POLYGON_OUTLINE_PREVIEW_RENDER_ORDER = 1001;

/** Float coordinates every preview part can hold before its buffer grows. */
const POLYGON_OUTLINE_PREVIEW_INITIAL_COORDINATES = 3 * 64;

/**
 * Draws the Polygon tool outline in progress: placed points, placed edges and
 * rubber-band edges to the pointer. It lives in the helper scene, so it shows
 * in every view and never reaches exports or the game preview.
 */
export class PolygonOutlinePreview {
  private readonly host: ShapeDrawPreviewHost;
  private readonly state: StatePolygonTool;
  private readonly root: THREE.Group;
  private readonly outlineLines: THREE.LineSegments;
  private readonly rubberBandLines: THREE.LineSegments;
  private readonly points: THREE.Points;
  private readonly unsubscribe: () => void;

  /**
   * Creates the preview, adds it to the helper scene and follows the state.
   *
   * @param host Helper scene host.
   * @param state Polygon tool state the preview draws.
   */
  constructor(host: ShapeDrawPreviewHost, state: StatePolygonTool) {
    this.host = host;
    this.state = state;
    this.outlineLines = PolygonOutlinePreview.linesCreate('polygon_outline_preview_edges', Theme.polygonOutlineColor);
    this.rubberBandLines = PolygonOutlinePreview.linesCreate(
      'polygon_outline_preview_rubber_band',
      Theme.polygonOutlineRubberBandColor,
    );
    this.points = PolygonOutlinePreview.pointsCreate();
    this.root = this.rootCreate();
    this.host.addHelper(this.root);
    this.unsubscribe = state.changeListenerAdd(() => this.refresh());
    this.refresh();
  }

  /**
   * Returns the preview scene object.
   *
   * @returns Preview root group.
   */
  previewObject(): THREE.Object3D {
    return this.root;
  }

  /**
   * Rebuilds the preview buffers from the state, hiding it while the tool is
   * off.
   */
  refresh(): void {
    const isShown = this.state.toolActiveRead();
    this.root.visible = isShown;
    if (!isShown) {
      return;
    }
    const buffers = PolygonOutlinePreviewGeometry.buffersBuild(
      this.state.verticesRead(),
      this.state.previewFrameRead(),
      this.state.cursorPointRead(),
    );
    PolygonOutlinePreview.positionsWrite(this.outlineLines, buffers.outlineSegments);
    PolygonOutlinePreview.positionsWrite(this.rubberBandLines, buffers.rubberBandSegments);
    PolygonOutlinePreview.positionsWrite(this.points, buffers.points);
  }

  /** Stops following the state, removes the preview and frees its resources. */
  dispose(): void {
    this.unsubscribe();
    this.host.removeHelper(this.root);
    [this.outlineLines, this.rubberBandLines, this.points].forEach((object) => {
      object.geometry.dispose();
      PolygonOutlinePreview.materialDispose(object.material);
    });
  }

  /**
   * Builds the hidden root group holding the preview parts.
   *
   * @returns Root group.
   */
  private rootCreate(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'polygon_outline_preview';
    root.userData[POLYGON_OUTLINE_PREVIEW_USERDATA_KEY] = true;
    root.visible = false;
    root.add(this.outlineLines, this.rubberBandLines, this.points);
    return root;
  }

  /**
   * Builds line segments drawn on top of the scene.
   *
   * @param name Object name.
   * @param color Line colour from the theme.
   * @returns Empty line segments.
   */
  private static linesCreate(name: string, color: number): THREE.LineSegments {
    const material = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true });
    const lines = new THREE.LineSegments(PolygonOutlinePreview.geometryCreate(), material);
    return PolygonOutlinePreview.overlayFlagsApply(lines, name);
  }

  /**
   * Builds the screen-sized outline points drawn on top of the scene.
   *
   * @returns Empty points object.
   */
  private static pointsCreate(): THREE.Points {
    const material = new THREE.PointsMaterial({
      color: Theme.polygonOutlineColor,
      size: Theme.polygonOutlinePointSizePx,
      sizeAttenuation: false,
      depthTest: false,
      transparent: true,
    });
    const points = new THREE.Points(PolygonOutlinePreview.geometryCreate(), material);
    return PolygonOutlinePreview.overlayFlagsApply(points, 'polygon_outline_preview_points');
  }

  /**
   * Applies the name, render order and culling flags every preview part uses.
   *
   * @param object Preview part.
   * @param name Object name.
   * @returns The same object.
   */
  private static overlayFlagsApply<Part extends THREE.Object3D>(object: Part, name: string): Part {
    object.name = name;
    object.renderOrder = POLYGON_OUTLINE_PREVIEW_RENDER_ORDER;
    object.frustumCulled = false;
    object.userData[POLYGON_OUTLINE_PREVIEW_USERDATA_KEY] = true;
    return object;
  }

  /**
   * Builds a position geometry with room for a number of coordinates, drawing
   * none of them yet.
   *
   * @param coordinateCapacity Number of float coordinates the buffer holds.
   * @returns Geometry with a preallocated position attribute.
   */
  private static geometryCreate(
    coordinateCapacity: number = POLYGON_OUTLINE_PREVIEW_INITIAL_COORDINATES,
  ): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(new Float32Array(coordinateCapacity), 3);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', attribute);
    geometry.setDrawRange(0, 0);
    return geometry;
  }

  /**
   * Writes positions into a preview part, reusing its buffer while it fits and
   * replacing a too-small geometry with one of at least double the room.
   *
   * @param object Preview part.
   * @param positions Flat world coordinates.
   */
  private static positionsWrite(object: THREE.LineSegments | THREE.Points, positions: Float32Array): void {
    const attribute = object.geometry.getAttribute('position');
    if (!(attribute instanceof THREE.BufferAttribute) || attribute.array.length < positions.length) {
      const capacity = Math.max(positions.length, (attribute?.array.length ?? 0) * 2);
      object.geometry.dispose();
      object.geometry = PolygonOutlinePreview.geometryCreate(capacity);
    }
    const target = object.geometry.getAttribute('position');
    if (target instanceof THREE.BufferAttribute) {
      target.array.set(positions);
      target.needsUpdate = true;
    }
    object.geometry.setDrawRange(0, positions.length / 3);
  }

  /**
   * Disposes one material or a material list.
   *
   * @param material Material of a preview part.
   */
  private static materialDispose(material: THREE.Material | THREE.Material[]): void {
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((entry) => entry.dispose());
  }
}
