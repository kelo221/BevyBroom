import * as THREE from 'three';
import { EntityVisualShapes } from '@/entity/visual/entity_visual_shapes.js';
import { EntityVisualPointBox } from '@/entity/visual/entity_visual_point_box.js';
import { type EntityGuideLineStyle, EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';
import type { RoomSettings } from '@/portal/model/room_settings.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** Color of room markers and outlines. */
export const ROOM_GUIDE_COLOR = 0x4fc3f7;

/** Icon every room shows. */
export const ROOM_ICON_NAME: IconName = 'floor-plan';

/** Opacity of the room box outline. */
const ROOM_GUIDE_OPACITY = 0.55;

/**
 * Builds and refreshes the editor-only visuals of a room owner: a clickable box
 * with a camera-facing icon at its center, and the outline of the room box.
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
    EntityVisualPointBox.ensure(owner, {
      name: 'Room Marker',
      iconName: ROOM_ICON_NAME,
      colorHex: ROOM_GUIDE_COLOR,
      opacity: 1,
    });
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
    const points: THREE.Vector3[] = [];
    const halfExtents = new THREE.Vector3(settings.halfSizeX, settings.halfSizeY, settings.halfSizeZ);
    EntityVisualShapes.boxEdgesAppend(points, halfExtents);
    return points;
  }
}
