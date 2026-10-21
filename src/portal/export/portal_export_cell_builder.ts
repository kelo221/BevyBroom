import * as THREE from 'three';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';

/**
 * Node extras key that turns a node into a DynLight room cell (a ±1 box under
 * the node transform).
 */
export const PORTAL_EXPORT_ROOM_EXTRAS_KEY = 'dynlight_room';

/**
 * Node extras key that turns a node into a DynLight portal (a ±1 square in
 * local XY, front +Z).
 */
export const PORTAL_EXPORT_PORTAL_EXTRAS_KEY = 'dynlight_portal';

/** Node extras key that marks a DynLight portal as closed. */
export const PORTAL_EXPORT_PORTAL_CLOSED_EXTRAS_KEY = 'dynlight_portal_closed';

/**
 * Builds the export node that describes a room or portal to game engines that
 * read DynLight node extras: an empty node scaled so the unit cell or square
 * matches the authored size.
 */
export class PortalExportCellBuilder {
  /**
   * Creates the extras node of a room or portal owner.
   *
   * @param owner Candidate entity owner.
   * @returns Extras node in owner space, or null for other objects.
   */
  static cellCreate(owner: THREE.Object3D): THREE.Object3D | null {
    return PortalExportCellBuilder.roomCellCreate(owner) ?? PortalExportCellBuilder.portalCellCreate(owner);
  }

  /**
   * Creates the room cell node of a room owner.
   *
   * @param owner Candidate room owner.
   * @returns Room cell node, or null when the object is not a room.
   */
  private static roomCellCreate(owner: THREE.Object3D): THREE.Object3D | null {
    const settings = RoomOwner.settingsRead(owner);
    if (!settings) {
      return null;
    }
    const cell = new THREE.Object3D();
    cell.name = `${owner.name} Room Cell`;
    cell.scale.set(settings.halfSizeX, settings.halfSizeY, settings.halfSizeZ);
    cell.userData[PORTAL_EXPORT_ROOM_EXTRAS_KEY] = true;
    return cell;
  }

  /**
   * Creates the portal node of a portal owner.
   *
   * @param owner Candidate portal owner.
   * @returns Portal node, or null when the object is not a portal.
   */
  private static portalCellCreate(owner: THREE.Object3D): THREE.Object3D | null {
    const settings = PortalOwner.settingsRead(owner);
    if (!settings) {
      return null;
    }
    const cell = new THREE.Object3D();
    cell.name = `${owner.name} Portal`;
    cell.scale.set(settings.width / 2, settings.height / 2, 1);
    cell.userData[PORTAL_EXPORT_PORTAL_EXTRAS_KEY] = true;
    if (settings.closed) {
      cell.userData[PORTAL_EXPORT_PORTAL_CLOSED_EXTRAS_KEY] = true;
    }
    return cell;
  }
}
