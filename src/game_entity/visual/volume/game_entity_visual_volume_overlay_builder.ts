import * as THREE from 'three';
import { ENTITY_VISUAL_PART_USERDATA_KEY } from '@/entity/model/entity_owner_keys.js';
import { EntityVisualHatchPlane } from '@/entity/visual/entity_visual_hatch_plane.js';
import { EntityVisualTextPlane, type EntityVisualTextPlaneOptions } from '@/entity/visual/entity_visual_text_plane.js';
import {
  GameEntityVisualVolumeFloorFrame,
  type GameEntityVolumePlanLevel,
} from '@/game_entity/visual/volume/game_entity_visual_volume_floor_frame.js';
import {
  type GameEntityVolumeRunBand,
  GameEntityVisualVolumeRunLayout,
} from '@/game_entity/visual/volume/game_entity_visual_volume_run_layout.js';
import type {
  GameEntityVolumeRun,
  GameEntityVolumeSpec,
} from '@/game_entity/visual/volume/game_entity_visual_volume_spec.js';
import { Theme } from '@/theme.js';

/** UserData key naming the role of each part of a volume marker drawing. */
export const GAME_ENTITY_VOLUME_PART_ROLE_KEY = 'gameEntityVolumePartRole';

/** Role of each part of a volume marker drawing. */
export type GameEntityVolumePartRole = 'band' | 'band_label' | 'tint' | 'hatch' | 'label' | 'separators';

/** UserData key on a band holding its position in the run list. */
export const GAME_ENTITY_VOLUME_BAND_INDEX_KEY = 'gameEntityVolumeBandIndex';

/** Opacity of floor bands and of the plain floor tint. */
const GAME_ENTITY_VOLUME_BAND_OPACITY = 0.55;
const GAME_ENTITY_VOLUME_TINT_OPACITY = 0.3;

/** Opacity of hatch stripes and of label backing plates. */
const GAME_ENTITY_VOLUME_HATCH_OPACITY = 0.75;
const GAME_ENTITY_VOLUME_LABEL_BACK_OPACITY = 0.7;

/**
 * Hatch stripe spacing: a share of the floor's shorter side, kept within
 * meters.
 */
const GAME_ENTITY_VOLUME_HATCH_SPACING = { share: 1 / 6, minimum: 0.15, maximum: 0.6 } as const;

/** Largest label heights in meters. */
const GAME_ENTITY_VOLUME_LABEL_MAXIMUM_HEIGHT = 0.5;
const GAME_ENTITY_VOLUME_BAND_LABEL_MAXIMUM_HEIGHT = 0.8;

/** Render order of floor drawings, bottom to top. */
const GAME_ENTITY_VOLUME_RENDER_ORDERS: Readonly<Record<GameEntityVolumePartRole, number>> = {
  tint: 10,
  band: 10,
  hatch: 11,
  separators: 12,
  band_label: 13,
  label: 13,
};

/**
 * Builds the plan drawing of a volume marker in the volume's local space: equal
 * colored bands per run with a numbered label each, a plain tint without runs,
 * diagonal stripes while hatched, and the label of the label field.
 */
export class GameEntityVisualVolumeOverlayBuilder {
  /**
   * Builds the floor group of a volume.
   *
   * @param spec What the marker draws.
   * @param localBounds Volume bounds in its local space.
   * @param scale Local scale of the volume.
   * @param level Face of the volume the drawing lies on.
   * @returns Floor group lying on that face.
   */
  static floorBuild(
    spec: GameEntityVolumeSpec,
    localBounds: THREE.Box3,
    scale: THREE.Vector3,
    level: GameEntityVolumePlanLevel,
  ): THREE.Group {
    const frame = new GameEntityVisualVolumeFloorFrame(localBounds, scale, level);
    const floor = frame.floorGroupCreate();
    if (spec.runs.length > 0) {
      GameEntityVisualVolumeOverlayBuilder.bandsAppend(floor, frame, spec, localBounds, scale);
    } else {
      GameEntityVisualVolumeOverlayBuilder.tintAppend(floor, frame, spec.markerColorHex);
    }
    if (spec.isHatched) {
      GameEntityVisualVolumeOverlayBuilder.hatchAppend(floor, frame);
    }
    if (spec.labelText !== null && spec.labelText.length > 0) {
      GameEntityVisualVolumeOverlayBuilder.labelAppend(floor, frame, spec);
    }
    floor.traverse((part) => GameEntityVisualVolumeOverlayBuilder.partMark(part));
    return floor;
  }

  /**
   * Adds one colored band and one numbered label per run, and the lines between
   * bands.
   *
   * @param floor Floor group.
   * @param frame Floor frame.
   * @param spec Marker spec with runs.
   * @param localBounds Volume bounds in its local space.
   * @param scale Local scale of the volume.
   */
  private static bandsAppend(
    floor: THREE.Group,
    frame: GameEntityVisualVolumeFloorFrame,
    spec: GameEntityVolumeSpec,
    localBounds: THREE.Box3,
    scale: THREE.Vector3,
  ): void {
    const layout = GameEntityVisualVolumeRunLayout.layoutOf(localBounds, scale, spec.runs.length);
    for (const band of layout.bands) {
      const run = spec.runs[band.index];
      if (run !== undefined) {
        GameEntityVisualVolumeOverlayBuilder.bandAppend(floor, frame, band, run);
      }
    }
    const meetings = layout.bands.slice(1).map((band) => band.start);
    floor.add(GameEntityVisualVolumeOverlayBuilder.separatorsCreate(frame, meetings));
  }

  /**
   * Adds the colored band of one run and its label, numbered from one.
   *
   * @param floor Floor group.
   * @param frame Floor frame.
   * @param band Band of the run along the run axis.
   * @param run Run drawn in the band.
   */
  private static bandAppend(
    floor: THREE.Group,
    frame: GameEntityVisualVolumeFloorFrame,
    band: GameEntityVolumeRunBand,
    run: GameEntityVolumeRun,
  ): void {
    const middle = (band.start + band.end) / 2;
    const bandLength = band.end - band.start;
    const quad = GameEntityVisualVolumeOverlayBuilder.quadCreate(bandLength, frame.crossLength(), run.colorHex);
    quad.userData[GAME_ENTITY_VOLUME_BAND_INDEX_KEY] = band.index;
    GameEntityVisualVolumeOverlayBuilder.partAdd(floor, frame, quad, 'band', middle, frame.crossAt(0.5));
    const room = { width: bandLength * 0.85, height: frame.crossLength() * 0.3 };
    const labelText = `${band.index + 1}  ${run.label}`;
    const text = GameEntityVisualVolumeOverlayBuilder.textCreate(
      labelText,
      room,
      GAME_ENTITY_VOLUME_BAND_LABEL_MAXIMUM_HEIGHT,
    );
    text.userData[GAME_ENTITY_VOLUME_BAND_INDEX_KEY] = band.index;
    GameEntityVisualVolumeOverlayBuilder.partAdd(floor, frame, text, 'band_label', middle, frame.crossAt(0.5));
  }

  /**
   * Adds a plain tint over the whole floor.
   *
   * @param floor Floor group.
   * @param frame Floor frame.
   * @param colorHex Tint color as an sRGB hex number.
   */
  private static tintAppend(floor: THREE.Group, frame: GameEntityVisualVolumeFloorFrame, colorHex: number): void {
    const quad = GameEntityVisualVolumeOverlayBuilder.quadCreate(frame.axisLength(), frame.crossLength(), colorHex);
    (quad.material as THREE.MeshBasicMaterial).opacity = GAME_ENTITY_VOLUME_TINT_OPACITY;
    GameEntityVisualVolumeOverlayBuilder.partAdd(
      floor,
      frame,
      quad,
      'tint',
      (frame.axisMin + frame.axisMax) / 2,
      frame.crossAt(0.5),
    );
  }

  /**
   * Adds diagonal stripes over the whole floor.
   *
   * @param floor Floor group.
   * @param frame Floor frame.
   */
  private static hatchAppend(floor: THREE.Group, frame: GameEntityVisualVolumeFloorFrame): void {
    const limits = GAME_ENTITY_VOLUME_HATCH_SPACING;
    const shorterSide = Math.min(frame.axisLength(), frame.crossLength());
    const spacing = Math.min(limits.maximum, Math.max(limits.minimum, shorterSide * limits.share));
    const hatch = EntityVisualHatchPlane.create(
      frame.axisLength(),
      frame.crossLength(),
      spacing,
      Theme.volumeMarkerHatchColor,
    );
    (hatch.material as THREE.MeshBasicMaterial).opacity = GAME_ENTITY_VOLUME_HATCH_OPACITY;
    GameEntityVisualVolumeOverlayBuilder.partAdd(
      floor,
      frame,
      hatch,
      'hatch',
      (frame.axisMin + frame.axisMax) / 2,
      frame.crossAt(0.5),
    );
  }

  /**
   * Adds the label field's text along the floor, toward the cross axis's
   * positive edge when bands carry labels of their own.
   *
   * @param floor Floor group.
   * @param frame Floor frame.
   * @param spec Marker spec with label text.
   */
  private static labelAppend(
    floor: THREE.Group,
    frame: GameEntityVisualVolumeFloorFrame,
    spec: GameEntityVolumeSpec,
  ): void {
    const hasBandLabels = spec.runs.length > 0;
    const crossShare = hasBandLabels ? 0.84 : 0.5;
    const room = { width: frame.axisLength() * 0.9, height: frame.crossLength() * (hasBandLabels ? 0.16 : 0.3) };
    const text = GameEntityVisualVolumeOverlayBuilder.textCreate(
      spec.labelText ?? '',
      room,
      GAME_ENTITY_VOLUME_LABEL_MAXIMUM_HEIGHT,
    );
    GameEntityVisualVolumeOverlayBuilder.partAdd(
      floor,
      frame,
      text,
      'label',
      (frame.axisMin + frame.axisMax) / 2,
      frame.crossAt(crossShare),
    );
  }

  /**
   * Places a flat drawing on the floor and records its role and render order.
   *
   * @param floor Floor group.
   * @param frame Floor frame.
   * @param drawing Drawing made along X for the run axis.
   * @param role Role of the drawing.
   * @param axisPosition Local run axis coordinate of its center.
   * @param crossPosition Local cross axis coordinate of its center.
   */
  private static partAdd(
    floor: THREE.Group,
    frame: GameEntityVisualVolumeFloorFrame,
    drawing: THREE.Object3D,
    role: GameEntityVolumePartRole,
    axisPosition: number,
    crossPosition: number,
  ): void {
    frame.drawingPlace(drawing, axisPosition, crossPosition);
    drawing.userData[GAME_ENTITY_VOLUME_PART_ROLE_KEY] = role;
    drawing.renderOrder = GAME_ENTITY_VOLUME_RENDER_ORDERS[role];
    floor.add(drawing);
  }

  /**
   * Creates a see-through colored quad.
   *
   * @param width Width along the run axis.
   * @param height Height along the cross axis.
   * @param colorHex Color as an sRGB hex number.
   * @returns Unpickable quad.
   */
  private static quadCreate(width: number, height: number, colorHex: number): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHex(colorHex, THREE.SRGBColorSpace),
      transparent: true,
      opacity: GAME_ENTITY_VOLUME_BAND_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    quad.raycast = () => undefined;
    return quad;
  }

  /**
   * Creates a floor text label fitting a room.
   *
   * @param text Text to show.
   * @param room Width along the run axis and height along the cross axis.
   * @param maximumHeight Largest text height in meters.
   * @returns Text plane.
   */
  private static textCreate(text: string, room: { width: number; height: number }, maximumHeight: number): THREE.Mesh {
    const options: EntityVisualTextPlaneOptions = {
      maximumWidth: room.width,
      maximumHeight: Math.min(maximumHeight, room.height),
      textColorHex: Theme.volumeMarkerLabelTextColor,
      backColorHex: Theme.volumeMarkerLabelBackColor,
      backOpacity: GAME_ENTITY_VOLUME_LABEL_BACK_OPACITY,
    };
    return EntityVisualTextPlane.create(text, options);
  }

  /**
   * Creates the lines across the floor between bands.
   *
   * @param frame Floor frame.
   * @param axisPositions Run axis coordinates where one band meets the next.
   * @returns Unpickable line segments.
   */
  private static separatorsCreate(
    frame: GameEntityVisualVolumeFloorFrame,
    axisPositions: readonly number[],
  ): THREE.LineSegments {
    const points = axisPositions.flatMap((axisPosition) => frame.crossLineAt(axisPosition));
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color().setHex(Theme.volumeMarkerBandSeparatorColor, THREE.SRGBColorSpace),
      transparent: true,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), material);
    lines.userData[GAME_ENTITY_VOLUME_PART_ROLE_KEY] = 'separators';
    lines.renderOrder = GAME_ENTITY_VOLUME_RENDER_ORDERS.separators;
    lines.raycast = () => undefined;
    return lines;
  }

  /**
   * Marks a drawing part as an editor-only visual.
   *
   * @param part Part of the floor group.
   */
  private static partMark(part: THREE.Object3D): void {
    part.userData[ENTITY_VISUAL_PART_USERDATA_KEY] = true;
  }

  /**
   * Frees the geometries, materials and textures of a floor group, keeping the
   * shared hatch tile.
   *
   * @param floor Floor group made by
   *   {@link GameEntityVisualVolumeOverlayBuilder.floorBuild}.
   */
  static floorDispose(floor: THREE.Object3D): void {
    floor.traverse((part) => {
      if (part instanceof THREE.Mesh || part instanceof THREE.LineSegments) {
        GameEntityVisualVolumeOverlayBuilder.drawingDispose(part);
      }
    });
  }

  /**
   * Frees the geometry, material and own texture of one drawing.
   *
   * @param drawing Mesh or line segments of a floor group.
   */
  private static drawingDispose(drawing: THREE.Mesh | THREE.LineSegments): void {
    drawing.geometry.dispose();
    const materials = Array.isArray(drawing.material) ? drawing.material : [drawing.material];
    for (const material of materials) {
      const map = material instanceof THREE.MeshBasicMaterial ? material.map : null;
      if (map !== null && map !== EntityVisualHatchPlane.stripeTextureShared()) {
        map.dispose();
      }
      material.dispose();
    }
  }
}
