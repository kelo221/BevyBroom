import * as THREE from 'three';
import type { EntityHandleTarget } from '@/entity/handles/entity_handle_drag_session.js';
import { entityHandleTargetOwned, entityHandleTargetsKey } from '@/entity/handles/entity_handle_targets.js';
import { Theme } from '@/theme.js';
import { worldSizeFromScreenPixels } from '@/transform/bounds/bounds_handle_screen_size.js';
import { shadingExemptFlag } from '@/viewports/shading/shading_exempt.js';

/** Radius of a handle ball on screen, in CSS pixels. */
export const ENTITY_HANDLE_BALL_PIXELS = 6;

/** Unit sphere every ball scales; never modified. */
const ENTITY_HANDLE_BALL_GEOMETRY = new THREE.SphereGeometry(1, 16, 12);

/** Draw order that keeps the balls above the scene. */
const ENTITY_HANDLE_RENDER_ORDER = 1000;

/** Name of the group holding the balls. */
export const ENTITY_HANDLE_OVERLAY_NAME = 'Entity Handles';

/** Scratch viewport rectangle read while placing a ball. */
const entityHandleViewportScratch = new THREE.Vector4();

/**
 * Draws one ball per entity handle, outside the world so it is never saved,
 * exported or selected. Each ball moves to where its handle sits in the pane
 * being drawn and keeps a constant size on screen.
 */
export class EntityHandleOverlay {
  readonly group: THREE.Group;
  private readonly material: THREE.MeshBasicMaterial;
  private targetsShown: EntityHandleTarget[] = [];

  /** Creates an empty overlay. */
  constructor() {
    this.group = new THREE.Group();
    this.group.name = ENTITY_HANDLE_OVERLAY_NAME;
    this.material = new THREE.MeshBasicMaterial({ color: Theme.selectionColor, depthTest: false, transparent: true });
  }

  /**
   * Returns the handles the overlay shows.
   *
   * @returns Shown handle targets.
   */
  targets(): readonly EntityHandleTarget[] {
    return this.targetsShown;
  }

  /**
   * Shows one ball per handle target. Keeps the balls when the same handles are
   * shown already.
   *
   * @param targets Handle targets to show.
   */
  targetsSet(targets: readonly EntityHandleTarget[]): void {
    if (entityHandleTargetsKey(targets) === entityHandleTargetsKey(this.targetsShown)) {
      return;
    }
    this.targetsShown = [...targets];
    this.group.clear();
    for (const target of this.targetsShown) {
      this.group.add(this.ballCreate(target));
    }
  }

  /**
   * Puts the overlay in the same parent as a world group, once that group has
   * one.
   *
   * @param worldObject Editor world root.
   */
  attachBeside(worldObject: THREE.Object3D): void {
    const parent = worldObject.parent;
    if (parent && this.group.parent !== parent) {
      parent.add(this.group);
    }
  }

  /**
   * Creates the ball of one handle. It is never hit by raycasts, keeps its
   * material in every shading mode and places itself before it is drawn in each
   * pane.
   *
   * @param target Handle target.
   * @returns Ball mesh.
   */
  private ballCreate(target: EntityHandleTarget): THREE.Mesh {
    const ball = new THREE.Mesh(ENTITY_HANDLE_BALL_GEOMETRY, this.material);
    ball.name = `Entity Handle ${target.handle.handleName}`;
    ball.renderOrder = ENTITY_HANDLE_RENDER_ORDER;
    ball.frustumCulled = false;
    ball.raycast = () => {};
    shadingExemptFlag(ball);
    ball.onBeforeRender = (renderer, _scene, camera) => EntityHandleOverlay.ballPlace(ball, target, renderer, camera);
    return ball;
  }

  /**
   * Moves a ball to where its handle sits for a camera and sizes it to a
   * constant number of pixels. A handle the owner no longer has collapses.
   *
   * @param ball Ball mesh.
   * @param target Handle target.
   * @param renderer Renderer drawing the pane.
   * @param camera Camera of the pane.
   */
  private static ballPlace(
    ball: THREE.Mesh,
    target: EntityHandleTarget,
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
  ): void {
    const settings = target.entityOwner.settingsRead(target.owner);
    const isShown = settings !== null && entityHandleTargetOwned(target, settings);
    if (isShown) {
      target.owner.updateWorldMatrix(true, false);
      ball.position.copy(target.handle.worldPositionFor({ owner: target.owner, camera }, settings));
    }
    const viewportHeight = renderer.getViewport(entityHandleViewportScratch).w;
    const distance = ball.position.distanceTo(camera.getWorldPosition(new THREE.Vector3()));
    const radius = worldSizeFromScreenPixels(camera, ENTITY_HANDLE_BALL_PIXELS, viewportHeight, distance);
    ball.scale.setScalar(isShown ? radius : 0);
    ball.updateMatrixWorld();
  }
}
