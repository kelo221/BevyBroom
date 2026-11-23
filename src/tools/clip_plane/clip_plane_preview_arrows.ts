import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Theme } from '@/theme.js';
import { ClipKeepMode, clipKeepModeKeepsBack, clipKeepModeKeepsFront } from './clip_keep_mode.js';
import { CLIP_PREVIEW_USERDATA_KEY } from './clip_plane_preview_keys.js';
import { clipPreviewScreenConstantScaleApply } from './clip_plane_preview_render_hooks.js';

/** UserData key marking a keep-side arrow; the value is +1 (front) or -1 (back). */
export const CLIP_SIDE_ARROW_DIRECTION_KEY = 'clipSideArrowDirection';

/** Gap between the plane and the arrow tail on screen, in CSS pixels. */
const CLIP_SIDE_ARROW_GAP_PIXELS = 4;

/** Shaft length on screen, in CSS pixels. */
const CLIP_SIDE_ARROW_SHAFT_PIXELS = 30;

/** Shaft radius on screen, in CSS pixels. */
const CLIP_SIDE_ARROW_SHAFT_RADIUS_PIXELS = 2.5;

/** Head length on screen, in CSS pixels. */
const CLIP_SIDE_ARROW_HEAD_PIXELS = 16;

/** Head radius on screen, in CSS pixels. */
const CLIP_SIDE_ARROW_HEAD_RADIUS_PIXELS = 8;

/** Extra outline thickness around shaft and head, in CSS pixels. */
const CLIP_SIDE_ARROW_OUTLINE_PIXELS = 1.5;

/** Draw order of the arrow outline; the colored arrow draws just above it. */
const CLIP_SIDE_ARROW_RENDER_ORDER = 1004;

/** Unit vector the arrow geometry points along before it is turned. */
const CLIP_SIDE_ARROW_MODEL_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * Builds the arrows that point from the cut into each piece the clip keeps: one
 * arrow for Side A or Side B, two opposite arrows in the colors of the two
 * pieces when both are kept. Arrows keep a constant size on screen.
 */
export class ClipPlanePreviewArrows {
  /**
   * Builds the keep-side arrows at a point on the plane.
   *
   * @param origin World point on the plane the arrows start at.
   * @param planeNormal World plane normal (points into Side A).
   * @param mode Which pieces the clip keeps.
   * @returns Arrow meshes (outline and fill per arrow).
   */
  static arrowsBuild(origin: THREE.Vector3, planeNormal: THREE.Vector3, mode: ClipKeepMode): THREE.Mesh[] {
    const normal = planeNormal.clone().normalize();
    const arrows: THREE.Mesh[] = [];
    if (clipKeepModeKeepsFront(mode)) {
      arrows.push(...ClipPlanePreviewArrows.arrowBuild(origin, normal, Theme.clipKeepColor, 1));
    }
    if (clipKeepModeKeepsBack(mode)) {
      const color = mode === ClipKeepMode.BOTH ? Theme.clipKeepSecondColor : Theme.clipKeepColor;
      arrows.push(...ClipPlanePreviewArrows.arrowBuild(origin, normal.clone().negate(), color, -1));
    }
    return arrows;
  }

  /**
   * Builds one arrow as a dark outline mesh and a colored mesh.
   *
   * @param origin World tail point.
   * @param direction Unit world direction.
   * @param color Arrow color.
   * @param sign +1 for the front arrow, -1 for the back arrow.
   * @returns Outline and fill meshes.
   */
  private static arrowBuild(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    color: number,
    sign: number,
  ): THREE.Mesh[] {
    const outline = ClipPlanePreviewArrows.arrowMeshBuild(
      origin,
      direction,
      Theme.clipMarkerHaloColor,
      CLIP_SIDE_ARROW_OUTLINE_PIXELS,
    );
    const fill = ClipPlanePreviewArrows.arrowMeshBuild(origin, direction, color, 0);
    outline.renderOrder = CLIP_SIDE_ARROW_RENDER_ORDER;
    fill.renderOrder = CLIP_SIDE_ARROW_RENDER_ORDER + 1;
    fill.userData[CLIP_SIDE_ARROW_DIRECTION_KEY] = sign;
    return [outline, fill];
  }

  /**
   * Builds one arrow mesh modeled in CSS pixels and turned to a direction.
   *
   * @param origin World tail point.
   * @param direction Unit world direction.
   * @param color Mesh color.
   * @param thickenPixels Extra radius and length in CSS pixels (outline pass).
   * @returns Arrow mesh drawn on top of the scene.
   */
  private static arrowMeshBuild(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    color: number,
    thickenPixels: number,
  ): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 1 });
    material.toneMapped = false;
    const arrow = new THREE.Mesh(ClipPlanePreviewArrows.arrowGeometryBuild(thickenPixels), material);
    arrow.position.copy(origin);
    arrow.quaternion.setFromUnitVectors(CLIP_SIDE_ARROW_MODEL_AXIS, direction);
    arrow.userData[CLIP_PREVIEW_USERDATA_KEY] = true;
    arrow.raycast = () => undefined;
    clipPreviewScreenConstantScaleApply(arrow, origin, 1);
    return arrow;
  }

  /**
   * Builds the shaft and head geometry along +Y, in CSS pixel units.
   *
   * @param thickenPixels Extra radius and length in CSS pixels.
   * @returns Arrow geometry.
   */
  private static arrowGeometryBuild(thickenPixels: number): THREE.BufferGeometry {
    const shaftRadius = CLIP_SIDE_ARROW_SHAFT_RADIUS_PIXELS + thickenPixels;
    const shaft = new THREE.CylinderGeometry(shaftRadius, shaftRadius, CLIP_SIDE_ARROW_SHAFT_PIXELS, 12);
    shaft.translate(0, CLIP_SIDE_ARROW_GAP_PIXELS + CLIP_SIDE_ARROW_SHAFT_PIXELS * 0.5, 0);
    const headLength = CLIP_SIDE_ARROW_HEAD_PIXELS + thickenPixels * 2;
    const head = new THREE.ConeGeometry(CLIP_SIDE_ARROW_HEAD_RADIUS_PIXELS + thickenPixels, headLength, 20);
    head.translate(0, CLIP_SIDE_ARROW_GAP_PIXELS + CLIP_SIDE_ARROW_SHAFT_PIXELS + headLength * 0.5 - thickenPixels, 0);
    const merged = mergeGeometries([shaft, head]) ?? shaft;
    if (merged !== shaft) shaft.dispose();
    head.dispose();
    return merged;
  }
}
