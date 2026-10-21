import * as THREE from 'three';
import { type EntityGuideLineStyle, EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';
import type { PortalSettings } from '@/portal/model/portal_settings.js';

/** Color of open portals. */
export const PORTAL_OPEN_COLOR = 0x66bb6a;

/** Color of closed portals. */
export const PORTAL_CLOSED_COLOR = 0xef5350;

/** Opacity of the clickable portal surface. */
const PORTAL_SURFACE_OPACITY = 0.22;

/** Opacity of the portal outline and front arrow. */
const PORTAL_GUIDE_OPACITY = 0.85;

/** Length of the front arrow as a fraction of the smaller portal extent. */
const PORTAL_ARROW_LENGTH_FRACTION = 0.5;

/**
 * Shared unit square marker geometry in the XY plane; scaled to the portal
 * size.
 */
const portalMarkerGeometry = new THREE.PlaneGeometry(1, 1);

/**
 * Builds and refreshes the editor-only visuals of a portal owner: a translucent
 * clickable surface, its outline (dashed when closed) and an arrow along the
 * front (+Z) side.
 */
export class PortalVisualBuilder {
  /**
   * Replaces the outline and arrow, and resizes and tints the surface.
   *
   * @param owner Portal owner group.
   * @param settings Portal settings.
   */
  static refresh(owner: THREE.Object3D, settings: PortalSettings): void {
    EntityVisualBuilder.guidesRemove(owner);
    const colorHex = settings.closed ? PORTAL_CLOSED_COLOR : PORTAL_OPEN_COLOR;
    const marker = EntityVisualBuilder.markerEnsure(owner, portalMarkerGeometry, 'Portal Surface');
    EntityVisualBuilder.markerTint(marker, colorHex, PORTAL_SURFACE_OPACITY);
    marker.scale.set(settings.width, settings.height, 1);
    const style: EntityGuideLineStyle = { colorHex, opacity: PORTAL_GUIDE_OPACITY, dashed: settings.closed };
    owner.add(EntityVisualBuilder.linesCreate(PortalVisualBuilder.outlinePoints(settings), style, 'Portal Outline'));
    const arrowStyle: EntityGuideLineStyle = { ...style, dashed: false };
    owner.add(EntityVisualBuilder.linesCreate(PortalVisualBuilder.arrowPoints(settings), arrowStyle, 'Portal Front'));
  }

  /**
   * Returns the rectangle outline as segment endpoint pairs.
   *
   * @param settings Portal settings.
   * @returns Endpoint pairs in owner space.
   */
  static outlinePoints(settings: PortalSettings): THREE.Vector3[] {
    const halfWidth = settings.width / 2;
    const halfHeight = settings.height / 2;
    const corners = [
      new THREE.Vector3(-halfWidth, -halfHeight, 0),
      new THREE.Vector3(halfWidth, -halfHeight, 0),
      new THREE.Vector3(halfWidth, halfHeight, 0),
      new THREE.Vector3(-halfWidth, halfHeight, 0),
    ];
    const points: THREE.Vector3[] = [];
    corners.forEach((corner, index) => {
      points.push(corner, corners[(index + 1) % corners.length] ?? corner);
    });
    return points;
  }

  /**
   * Returns an arrow from the portal center along +Z with a two-line head.
   *
   * @param settings Portal settings.
   * @returns Endpoint pairs in owner space.
   */
  static arrowPoints(settings: PortalSettings): THREE.Vector3[] {
    const length = Math.min(settings.width, settings.height) * PORTAL_ARROW_LENGTH_FRACTION;
    const tip = new THREE.Vector3(0, 0, length);
    const headBack = length * 0.7;
    const headSide = length * 0.2;
    return [
      new THREE.Vector3(),
      tip,
      tip,
      new THREE.Vector3(headSide, 0, headBack),
      tip,
      new THREE.Vector3(-headSide, 0, headBack),
    ];
  }
}
