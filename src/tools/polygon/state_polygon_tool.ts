import * as THREE from 'three';
import {
  polygonOutlineRecipeFromFrame,
  polygonOutlineRecipeRead,
  polygonOutlineRecipeToFrame,
  type PolygonOutlineRecipe,
} from './polygon_outline_recipe.js';
import type { PolygonExtrusionFrame } from './polygon_convex_decomposer.js';
import { PolygonSketchFrame } from './sketch/polygon_sketch_frame.js';
import type { PolygonSketchClientProjector, PolygonSketchHit } from './sketch/polygon_sketch_projector.js';

/** Listener notified when the active Polygon tool outline or depth changes. */
export type StatePolygonToolListener = () => void;

/**
 * Holds the interactive 2D outline vertices, sketching plane, extrusion depth,
 * pointer cursor and optional re-edit target for the Hammer++ Polygon brush
 * tool.
 */
export class StatePolygonTool {
  private toolActive: boolean;
  private vertices: THREE.Vector2[];
  private frame: PolygonExtrusionFrame;
  private cursorHit: PolygonSketchHit | null;
  private editingTarget: THREE.Object3D | null;
  private commitDelegate: ((recipe: PolygonOutlineRecipe, target: THREE.Object3D | null) => THREE.Mesh[]) | null;
  private clientPointProjector: PolygonSketchClientProjector | null;
  private readonly listeners: Set<StatePolygonToolListener>;

  /**
   * Creates a default Polygon tool state in the XZ top plane (`extrusionMax =
   * 2`).
   */
  constructor() {
    this.toolActive = false;
    this.vertices = [];
    this.frame = StatePolygonTool.defaultTopFrameCreate(2);
    this.cursorHit = null;
    this.editingTarget = null;
    this.commitDelegate = null;
    this.clientPointProjector = null;
    this.listeners = new Set();
  }

  /**
   * Returns whether the Polygon brush tool is currently active.
   *
   * @returns True when active.
   */
  toolActiveRead(): boolean {
    return this.toolActive;
  }

  /**
   * Sets whether the Polygon brush tool is currently active. Turning the tool
   * off discards the outline in progress and the pointer cursor.
   *
   * @param active True when active.
   */
  toolActiveWrite(active: boolean): void {
    if (this.toolActive === active) {
      return;
    }
    this.toolActive = active;
    if (!active) {
      this.vertices = [];
      this.editingTarget = null;
      this.cursorHit = null;
    }
    this.listenersNotify();
  }

  /**
   * Registers the viewport client-point-to-sketch-plane projector.
   *
   * @param projector Projector mapping client points onto the sketch plane, or
   *   null to clear.
   */
  clientPointProjectorWrite(projector: PolygonSketchClientProjector | null): void {
    this.clientPointProjector = projector;
  }

  /**
   * Projects a viewport click onto the sketching plane and adds a 2D vertex.
   * The first vertex adopts the plane of the view it was placed in.
   *
   * @param clientX Viewport client X.
   * @param clientY Viewport client Y.
   * @returns True when a vertex was added.
   */
  placeVertexAtClientPoint(clientX: number, clientY: number): boolean {
    const hit = this.sketchHitAtClientPoint(clientX, clientY);
    if (!hit) {
      return false;
    }
    if (this.vertices.length === 0) {
      this.frame = PolygonSketchFrame.copy(hit.frame);
    }
    this.vertexAdd(hit.point);
    return true;
  }

  /**
   * Moves the pointer cursor of the rubber-band edge to a client point, or
   * hides it when the point is off the sketch plane.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   */
  cursorUpdateAtClientPoint(clientX: number, clientY: number): void {
    const hit = this.sketchHitAtClientPoint(clientX, clientY);
    if (StatePolygonTool.sketchHitsEqual(this.cursorHit, hit)) {
      return;
    }
    this.cursorHit = hit;
    this.listenersNotify();
  }

  /** Hides the pointer cursor of the rubber-band edge. */
  cursorClear(): void {
    if (!this.cursorHit) {
      return;
    }
    this.cursorHit = null;
    this.listenersNotify();
  }

  /**
   * Returns the pointer cursor on the sketch plane.
   *
   * @returns Cursor sketch coordinate, or null when hidden.
   */
  cursorPointRead(): THREE.Vector2 | null {
    return this.cursorHit?.point ?? null;
  }

  /**
   * Returns the frame previews draw in: the outline frame once a vertex is
   * placed, otherwise the frame under the pointer cursor.
   *
   * @returns Preview sketch frame.
   */
  previewFrameRead(): PolygonExtrusionFrame {
    if (this.vertices.length === 0 && this.cursorHit) {
      return this.cursorHit.frame;
    }
    return this.frame;
  }

  /**
   * Returns the current 2D outline vertices.
   *
   * @returns Read-only list of 2D vertices.
   */
  verticesRead(): readonly THREE.Vector2[] {
    return this.vertices;
  }

  /**
   * Appends a 2D vertex to the active polygon outline.
   *
   * @param point 2D coordinate in the sketching plane.
   */
  vertexAdd(point: THREE.Vector2): void {
    this.vertices.push(point.clone());
    this.listenersNotify();
  }

  /**
   * Moves an existing 2D outline vertex by index.
   *
   * @param index Vertex index.
   * @param point New 2D coordinate.
   */
  vertexMove(index: number, point: THREE.Vector2): void {
    const existing = this.vertices[index];
    if (!existing) {
      return;
    }
    existing.copy(point);
    this.listenersNotify();
  }

  /** Removes the most recently placed outline vertex (`Backspace`). */
  vertexRemoveLast(): void {
    if (this.vertices.length === 0) {
      return;
    }
    this.vertices.pop();
    this.listenersNotify();
  }

  /**
   * Returns the current extrusion depth (`extrusionMax - extrusionMin`).
   *
   * @returns Extrusion height in meters.
   */
  extrusionDepthRead(): number {
    return this.frame.extrusionMax - this.frame.extrusionMin;
  }

  /**
   * Updates the extrusion height along `axisNormal`.
   *
   * @param depth Positive extrusion depth in meters.
   */
  extrusionDepthWrite(depth: number): void {
    const clamped = Math.max(0.125, depth);
    this.frame.extrusionMax = this.frame.extrusionMin + clamped;
    this.listenersNotify();
  }

  /**
   * Sets the sketching plane frame (origin, U, V, normal).
   *
   * @param frame Extrusion plane frame.
   */
  frameWrite(frame: PolygonExtrusionFrame): void {
    this.frame = PolygonSketchFrame.copy(frame);
    this.listenersNotify();
  }

  /**
   * Loads an existing Polygon-authored brush or CSG group for re-editing.
   *
   * @param object Candidate brush or group.
   * @returns True when a polygon recipe was found and loaded.
   */
  loadFromTarget(object: THREE.Object3D | null): boolean {
    const recipe = polygonOutlineRecipeRead(object);
    if (!recipe || !object) {
      return false;
    }
    const { outline, frame } = polygonOutlineRecipeToFrame(recipe);
    this.vertices = outline;
    this.frame = frame;
    this.editingTarget = object;
    this.listenersNotify();
    return true;
  }

  /**
   * Returns the currently loaded re-edit target object, if any.
   *
   * @returns Target brush/group or null.
   */
  editingTargetRead(): THREE.Object3D | null {
    return this.editingTarget;
  }

  /**
   * Forgets the re-edit target once it is no longer part of the world, for
   * example after undo removed it.
   *
   * @param worldObject World root the target must live under.
   */
  editingTargetForgetWhenDetached(worldObject: THREE.Object3D): void {
    if (!this.editingTarget || StatePolygonTool.isDescendantOf(this.editingTarget, worldObject)) {
      return;
    }
    this.editingTarget = null;
    this.listenersNotify();
  }

  /**
   * Returns whether an object lies under a root.
   *
   * @param object Object to test.
   * @param root Root object.
   * @returns True when the object is the root or one of its descendants.
   */
  private static isDescendantOf(object: THREE.Object3D, root: THREE.Object3D): boolean {
    for (let current: THREE.Object3D | null = object; current; current = current.parent) {
      if (current === root) {
        return true;
      }
    }
    return false;
  }

  /** Clears the active polygon outline and resets re-edit target state. */
  clear(): void {
    this.vertices = [];
    this.editingTarget = null;
    this.listenersNotify();
  }

  /**
   * Registers the delegate that commits or regenerates polygon brushes.
   *
   * @param delegate Commit callback, or null to clear.
   */
  commitDelegateWrite(
    delegate: ((recipe: PolygonOutlineRecipe, target: THREE.Object3D | null) => THREE.Mesh[]) | null,
  ): void {
    this.commitDelegate = delegate;
  }

  /**
   * Builds the current `PolygonOutlineRecipe` if at least 3 vertices are
   * placed.
   *
   * @returns Recipe, or null when fewer than 3 vertices exist.
   */
  recipeBuild(): PolygonOutlineRecipe | null {
    if (this.vertices.length < 3) {
      return null;
    }
    return polygonOutlineRecipeFromFrame(this.vertices, this.frame);
  }

  /**
   * Commits the current outline (or updates `editingTarget`) and clears
   * vertices.
   *
   * @returns Created or regenerated brush meshes.
   */
  commit(): THREE.Mesh[] {
    const recipe = this.recipeBuild();
    if (!recipe || !this.commitDelegate) {
      return [];
    }
    const meshes = this.commitDelegate(recipe, this.editingTarget);
    if (meshes.length > 0) {
      this.clear();
    }
    return meshes;
  }

  /**
   * Subscribes to Polygon tool state changes.
   *
   * @param listener Change callback.
   * @returns Unsubscribe function.
   */
  changeListenerAdd(listener: StatePolygonToolListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Creates a default XZ top-view extrusion frame (`Y` up).
   *
   * @param depth Default extrusion height.
   * @returns Extrusion frame.
   */
  private static defaultTopFrameCreate(depth: number): PolygonExtrusionFrame {
    return {
      origin: new THREE.Vector3(0, 0, 0),
      axisU: new THREE.Vector3(1, 0, 0),
      axisV: new THREE.Vector3(0, 0, 1),
      axisNormal: new THREE.Vector3(0, 1, 0),
      extrusionMin: 0,
      extrusionMax: depth,
    };
  }

  /**
   * Maps a client point onto the outline frame, or onto the plane of the view
   * under the pointer before the first vertex is placed.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns Sketch hit, or null without a projector or when the point misses.
   */
  private sketchHitAtClientPoint(clientX: number, clientY: number): PolygonSketchHit | null {
    if (!this.clientPointProjector) {
      return null;
    }
    const lockedFrame = this.vertices.length > 0 ? this.frame : null;
    return this.clientPointProjector(clientX, clientY, lockedFrame, this.extrusionDepthRead());
  }

  /**
   * Returns whether two sketch hits name the same point on the same plane.
   *
   * @param first First hit, or null.
   * @param second Second hit, or null.
   * @returns True when both are null or both match.
   */
  private static sketchHitsEqual(first: PolygonSketchHit | null, second: PolygonSketchHit | null): boolean {
    if (!first || !second) {
      return first === second;
    }
    return (
      first.point.equals(second.point) &&
      first.frame.origin.equals(second.frame.origin) &&
      first.frame.axisNormal.equals(second.frame.axisNormal)
    );
  }

  /** Notifies all registered state listeners. */
  private listenersNotify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

let sharedPolygonToolState: StatePolygonTool | null = null;

/**
 * Returns the shared Polygon tool state singleton.
 *
 * @returns Shared StatePolygonTool.
 */
export function getStatePolygonTool(): StatePolygonTool {
  if (!sharedPolygonToolState) {
    sharedPolygonToolState = new StatePolygonTool();
  }
  return sharedPolygonToolState;
}
