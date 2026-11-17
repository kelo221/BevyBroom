import * as THREE from 'three';
import type { EntityHandleTarget } from '@/entity/handles/entity_handle_drag_session.js';
import {
  ENTITY_HANDLE_ARROW_MIN_SCREEN_SHARE,
  ENTITY_HANDLE_ARROW_PIXELS,
  entityHandleArrowTipWorld,
  entityHandleAxisColorOf,
} from '@/entity/handles/entity_handle_axis.js';
import { entityHandleTargetOwned } from '@/entity/handles/entity_handle_targets.js';
import { worldSizeFromScreenPixels } from '@/transform/bounds/bounds_handle_screen_size.js';
import { shadingExemptFlag } from '@/viewports/shading/shading_exempt.js';

/** Share of an arrow's length taken by its shaft; the head takes the rest. */
const ENTITY_HANDLE_ARROW_SHAFT_SHARE = 0.75;

/** Radius of an arrow shaft on screen, in CSS pixels. */
const ENTITY_HANDLE_ARROW_SHAFT_PIXELS = 1.5;

/** Radius of an arrow head on screen, in CSS pixels. */
const ENTITY_HANDLE_ARROW_HEAD_PIXELS = 5;

/** Draw order that keeps the arrows above the scene, just under the balls. */
const ENTITY_HANDLE_ARROW_RENDER_ORDER = 999;

/** Unit shaft standing on the origin along +Y; never modified. */
const ENTITY_HANDLE_ARROW_SHAFT_GEOMETRY = new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0);

/** Unit cone standing on the origin along +Y; never modified. */
const ENTITY_HANDLE_ARROW_HEAD_GEOMETRY = new THREE.ConeGeometry(1, 1, 12).translate(0, 0.5, 0);

/** Up direction the arrow geometry is built along. */
const ENTITY_HANDLE_ARROW_UP = new THREE.Vector3(0, 1, 0);

/** Scratch viewport rectangle read while placing an arrow. */
const entityHandleArrowViewportScratch = new THREE.Vector4();

/** World placement of one arrow for one frame. */
interface EntityHandleArrowPlacement {
  readonly origin: THREE.Vector3;
  readonly axis: THREE.Vector3;
  readonly length: number;
  readonly isShown: boolean;
}

/**
 * One move arrow of a handle, a shaft and a cone in the colour of the world
 * axis it runs along. It keeps the same size on screen and hides itself when it
 * points too far into the screen to grab.
 */
export class EntityHandleOverlayArrow {
  readonly meshes: readonly THREE.Mesh[];
  private readonly target: EntityHandleTarget;
  private readonly axisIndex: number;

  /**
   * Creates the arrow of one handle axis.
   *
   * @param target Handle target.
   * @param axisIndex Index of the axis among the handle's axes.
   * @param color Arrow colour.
   */
  constructor(target: EntityHandleTarget, axisIndex: number, color: number) {
    this.target = target;
    this.axisIndex = axisIndex;
    const material = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true });
    const shaft = this.meshCreate(ENTITY_HANDLE_ARROW_SHAFT_GEOMETRY, material, 'Shaft');
    const head = this.meshCreate(ENTITY_HANDLE_ARROW_HEAD_GEOMETRY, material, 'Head');
    shaft.onBeforeRender = (renderer, _scene, camera) => this.shaftPlace(shaft, renderer, camera);
    head.onBeforeRender = (renderer, _scene, camera) => this.headPlace(head, renderer, camera);
    this.meshes = [shaft, head];
  }

  /**
   * Creates the arrows of every axis of a handle.
   *
   * @param target Handle target.
   * @returns Arrows; none when the handle lists no axes.
   */
  static arrowsOf(target: EntityHandleTarget): EntityHandleOverlayArrow[] {
    const settings = target.entityOwner.settingsRead(target.owner);
    if (settings === null) {
      return [];
    }
    const view = { owner: target.owner, camera: new THREE.Camera() };
    return target.handle
      .axesFor(view, settings)
      .map((axis, axisIndex) => new EntityHandleOverlayArrow(target, axisIndex, entityHandleAxisColorOf(axis)));
  }

  /**
   * Creates one click-through, always visible part of the arrow.
   *
   * @param geometry Shared unit geometry.
   * @param material Arrow material.
   * @param partName Part name.
   * @returns Mesh.
   */
  private meshCreate(geometry: THREE.BufferGeometry, material: THREE.Material, partName: string): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Entity Handle Arrow ${partName} ${this.target.handle.handleName} ${this.axisIndex}`;
    mesh.renderOrder = ENTITY_HANDLE_ARROW_RENDER_ORDER;
    mesh.frustumCulled = false;
    mesh.raycast = () => {};
    shadingExemptFlag(mesh);
    return mesh;
  }

  /**
   * Places the shaft from the handle along its axis.
   *
   * @param shaft Shaft mesh.
   * @param renderer Renderer drawing the pane.
   * @param camera Camera of the pane.
   */
  private shaftPlace(shaft: THREE.Mesh, renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    const placement = this.placementCompute(renderer, camera);
    const radius = this.screenSize(camera, renderer, placement.origin, ENTITY_HANDLE_ARROW_SHAFT_PIXELS);
    shaft.position.copy(placement.origin);
    shaft.quaternion.setFromUnitVectors(ENTITY_HANDLE_ARROW_UP, placement.axis);
    shaft.scale.set(radius, placement.length * ENTITY_HANDLE_ARROW_SHAFT_SHARE, radius);
    EntityHandleOverlayArrow.shownApply(shaft, placement.isShown);
  }

  /**
   * Places the head at the end of the shaft.
   *
   * @param head Head mesh.
   * @param renderer Renderer drawing the pane.
   * @param camera Camera of the pane.
   */
  private headPlace(head: THREE.Mesh, renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    const placement = this.placementCompute(renderer, camera);
    const radius = this.screenSize(camera, renderer, placement.origin, ENTITY_HANDLE_ARROW_HEAD_PIXELS);
    head.position
      .copy(placement.origin)
      .addScaledVector(placement.axis, placement.length * ENTITY_HANDLE_ARROW_SHAFT_SHARE);
    head.quaternion.setFromUnitVectors(ENTITY_HANDLE_ARROW_UP, placement.axis);
    head.scale.set(radius, placement.length * (1 - ENTITY_HANDLE_ARROW_SHAFT_SHARE), radius);
    EntityHandleOverlayArrow.shownApply(head, placement.isShown);
  }

  /**
   * Computes where the arrow sits this frame and whether it is shown.
   *
   * @param renderer Renderer drawing the pane.
   * @param camera Camera of the pane.
   * @returns Placement.
   */
  private placementCompute(renderer: THREE.WebGLRenderer, camera: THREE.Camera): EntityHandleArrowPlacement {
    const settings = this.target.entityOwner.settingsRead(this.target.owner);
    if (settings === null || !entityHandleTargetOwned(this.target, settings)) {
      return { origin: new THREE.Vector3(), axis: ENTITY_HANDLE_ARROW_UP, length: 0, isShown: false };
    }
    this.target.owner.updateWorldMatrix(true, false);
    const view = { owner: this.target.owner, camera };
    const origin = this.target.handle.worldPositionFor(view, settings);
    const axis = this.target.handle.axesFor(view, settings)[this.axisIndex] ?? ENTITY_HANDLE_ARROW_UP;
    const viewport = renderer.getViewport(entityHandleArrowViewportScratch);
    const tip = entityHandleArrowTipWorld(camera, origin, axis, viewport.w);
    const isShown =
      EntityHandleOverlayArrow.screenLengthPixels(origin, tip, camera, viewport) >=
      ENTITY_HANDLE_ARROW_PIXELS * ENTITY_HANDLE_ARROW_MIN_SCREEN_SHARE;
    return { origin, axis, length: origin.distanceTo(tip), isShown };
  }

  /**
   * Converts a size in CSS pixels to world units at a point.
   *
   * @param camera Camera of the pane.
   * @param renderer Renderer drawing the pane.
   * @param point World point.
   * @param pixels Size in CSS pixels.
   * @returns World size.
   */
  private screenSize(
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    point: THREE.Vector3,
    pixels: number,
  ): number {
    const viewportHeight = renderer.getViewport(entityHandleArrowViewportScratch).w;
    const distance = point.distanceTo(camera.getWorldPosition(new THREE.Vector3()));
    return worldSizeFromScreenPixels(camera, pixels, viewportHeight, distance);
  }

  /**
   * Returns the on-screen length of a world segment in pixels of a pane.
   *
   * @param start World start.
   * @param end World end.
   * @param camera Camera of the pane.
   * @param viewport Pane rectangle; z is its width and w its height in pixels.
   * @returns Length in pixels.
   */
  private static screenLengthPixels(
    start: THREE.Vector3,
    end: THREE.Vector3,
    camera: THREE.Camera,
    viewport: THREE.Vector4,
  ): number {
    const startNdc = start.clone().project(camera);
    const endNdc = end.clone().project(camera);
    const deltaX = ((endNdc.x - startNdc.x) / 2) * viewport.z;
    const deltaY = ((endNdc.y - startNdc.y) / 2) * viewport.w;
    return Math.hypot(deltaX, deltaY);
  }

  /**
   * Hides a part by scaling it to nothing, and refreshes its matrix.
   *
   * @param mesh Arrow part.
   * @param isShown Whether the arrow is shown.
   */
  private static shownApply(mesh: THREE.Mesh, isShown: boolean): void {
    if (!isShown) {
      mesh.scale.setScalar(0);
    }
    mesh.updateMatrixWorld();
  }
}
