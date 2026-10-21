import * as THREE from 'three';
import { type EntityGuideLineStyle, EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';
import type { RoomSettings } from '@/portal/model/room_settings.js';

/** Color of room markers and outlines. */
export const ROOM_GUIDE_COLOR = 0x4fc3f7;

/** Edge length of the clickable room marker in meters. */
const ROOM_MARKER_SIZE = 0.25;

/** Opacity of the room box outline. */
const ROOM_GUIDE_OPACITY = 0.55;

/** Shared marker geometry; never disposed because every room marker uses it. */
const roomMarkerGeometry = new THREE.BoxGeometry(ROOM_MARKER_SIZE, ROOM_MARKER_SIZE, ROOM_MARKER_SIZE);

/**
 * Corner sign pairs of the twelve edges of a unit box, as index pairs into the
 * eight corners.
 */
const ROOM_BOX_EDGE_CORNER_PAIRS: readonly (readonly [number, number])[] = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

/**
 * Builds and refreshes the editor-only visuals of a room owner: a clickable
 * center marker and the outline of the room box.
 */
export class RoomVisualBuilder {
  /**
   * Replaces the room outline and keeps the marker.
   *
   * @param owner Room owner group.
   * @param settings Room settings.
   */
  static refresh(owner: THREE.Object3D, settings: RoomSettings): void {
    EntityVisualBuilder.guidesRemove(owner);
    const marker = EntityVisualBuilder.markerEnsure(owner, roomMarkerGeometry, 'Room Marker');
    EntityVisualBuilder.markerTint(marker, ROOM_GUIDE_COLOR, 1);
    const style: EntityGuideLineStyle = { colorHex: ROOM_GUIDE_COLOR, opacity: ROOM_GUIDE_OPACITY, dashed: false };
    owner.add(EntityVisualBuilder.linesCreate(RoomVisualBuilder.boxEdgePoints(settings), style, 'Room Bounds'));
  }

  /**
   * Returns the twelve box edges as segment endpoint pairs.
   *
   * @param settings Room settings.
   * @returns Endpoint pairs in owner space.
   */
  static boxEdgePoints(settings: RoomSettings): THREE.Vector3[] {
    const corners = RoomVisualBuilder.boxCorners(settings);
    const points: THREE.Vector3[] = [];
    for (const [first, second] of ROOM_BOX_EDGE_CORNER_PAIRS) {
      const firstCorner = corners[first];
      const secondCorner = corners[second];
      if (firstCorner && secondCorner) {
        points.push(firstCorner, secondCorner);
      }
    }
    return points;
  }

  /**
   * Returns the eight box corners, ordered so bit 0 picks +X, bit 1 +Y and bit
   * 2 +Z.
   *
   * @param settings Room settings.
   * @returns Corner positions in owner space.
   */
  private static boxCorners(settings: RoomSettings): THREE.Vector3[] {
    const corners: THREE.Vector3[] = [];
    for (let index = 0; index < 8; index++) {
      corners.push(
        new THREE.Vector3(
          index & 1 ? settings.halfSizeX : -settings.halfSizeX,
          index & 2 ? settings.halfSizeY : -settings.halfSizeY,
          index & 4 ? settings.halfSizeZ : -settings.halfSizeZ,
        ),
      );
    }
    return corners;
  }
}
