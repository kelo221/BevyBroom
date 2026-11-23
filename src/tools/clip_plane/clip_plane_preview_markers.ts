import * as THREE from 'three';
import { Theme } from '@/theme.js';
import {
  CLIP_MARKER_CORE_PIXELS,
  CLIP_MARKER_HALO_PIXELS,
  CLIP_MARKER_HOVER_GROWTH_PIXELS,
  CLIP_MARKER_INDEX_KEY,
  CLIP_MARKER_PREVIEW_OPACITY,
  CLIP_MARKER_PREVIEW_SIZE_SHARE,
  CLIP_MARKER_RIM_PIXELS,
  getClipPointColor,
} from './clip_plane_marker_style.js';
import { CLIP_PREVIEW_USERDATA_KEY } from './clip_plane_preview_keys.js';
import { clipPreviewScreenConstantScaleApply } from './clip_plane_preview_render_hooks.js';

/** UserData key marking the pointer preview marker. */
export const CLIP_MARKER_POINTER_PREVIEW_KEY = 'isClipPointerPreviewMarker';

/** Draw order of the marker outline; rim and core draw just above it. */
const CLIP_MARKER_RENDER_ORDER = 1010;

/** Look of one marker: point color, size multiplier and core opacity. */
interface ClipPreviewMarkerLook {
  readonly color: number;
  readonly sizeScale: number;
  readonly growthPixels: number;
  readonly coreOpacity: number;
}

/**
 * Builds the round placement markers of the clip tool: a dark outline, a light
 * rim and a colored core, each a constant size on screen in every pane.
 */
export class ClipPlanePreviewMarkers {
  /**
   * Builds one marker per placed point and a smaller translucent marker for the
   * pointer preview point.
   *
   * @param points Placed points.
   * @param pointerPreviewPoint Point under the pointer while placing point 2,
   *   or null.
   * @param hoveredIndex Index of the placed point under the pointer, or null.
   * @returns Marker groups to add to the preview root.
   */
  static markersBuild(
    points: readonly THREE.Vector3[],
    pointerPreviewPoint: THREE.Vector3 | null,
    hoveredIndex: number | null,
  ): THREE.Group[] {
    const markers = points.map((point, index) => {
      const growthPixels = index === hoveredIndex ? CLIP_MARKER_HOVER_GROWTH_PIXELS : 0;
      const look = { color: getClipPointColor(index), sizeScale: 1, growthPixels, coreOpacity: 1 };
      const marker = ClipPlanePreviewMarkers.markerBuild(point, look);
      marker.userData[CLIP_MARKER_INDEX_KEY] = index;
      return marker;
    });
    if (pointerPreviewPoint)
      markers.push(ClipPlanePreviewMarkers.pointerPreviewMarkerBuild(pointerPreviewPoint, points.length));
    return markers;
  }

  /**
   * Builds the translucent marker of the point the next click would place.
   *
   * @param point Point under the pointer.
   * @param index Index the point would get once placed.
   * @returns Marker group.
   */
  private static pointerPreviewMarkerBuild(point: THREE.Vector3, index: number): THREE.Group {
    const look = {
      color: getClipPointColor(index),
      sizeScale: CLIP_MARKER_PREVIEW_SIZE_SHARE,
      growthPixels: 0,
      coreOpacity: CLIP_MARKER_PREVIEW_OPACITY,
    };
    const marker = ClipPlanePreviewMarkers.markerBuild(point, look);
    marker.userData[CLIP_MARKER_POINTER_PREVIEW_KEY] = true;
    return marker;
  }

  /**
   * Builds one marker group at a point.
   *
   * @param point World point.
   * @param look Marker color, size and opacity.
   * @returns Marker group.
   */
  private static markerBuild(point: THREE.Vector3, look: ClipPreviewMarkerLook): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(point);
    group.userData[CLIP_PREVIEW_USERDATA_KEY] = true;
    const radius = (pixels: number): number => pixels * look.sizeScale + look.growthPixels;
    group.add(
      ClipPlanePreviewMarkers.discBuild(point, radius(CLIP_MARKER_HALO_PIXELS), Theme.clipMarkerHaloColor, 0.85, 0),
      ClipPlanePreviewMarkers.discBuild(point, radius(CLIP_MARKER_RIM_PIXELS), Theme.clipMarkerRimColor, 1, 1),
      ClipPlanePreviewMarkers.discBuild(point, radius(CLIP_MARKER_CORE_PIXELS), look.color, look.coreOpacity, 2),
    );
    return group;
  }

  /**
   * Builds one layer of a marker: a sphere drawn on top of everything with a
   * constant radius on screen.
   *
   * @param anchor World point of the marker.
   * @param radiusPixels Radius on screen in CSS pixels.
   * @param color Layer color.
   * @param opacity Layer opacity.
   * @param layer Layer index above the outline (0 outline, 1 rim, 2 core).
   * @returns Layer mesh.
   */
  private static discBuild(
    anchor: THREE.Vector3,
    radiusPixels: number,
    color: number,
    opacity: number,
    layer: number,
  ): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false });
    material.toneMapped = false;
    const disc = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), material);
    disc.userData[CLIP_PREVIEW_USERDATA_KEY] = true;
    disc.renderOrder = CLIP_MARKER_RENDER_ORDER + layer;
    disc.raycast = () => undefined;
    clipPreviewScreenConstantScaleApply(disc, anchor, radiusPixels);
    return disc;
  }
}
