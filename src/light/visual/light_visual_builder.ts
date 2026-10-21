import * as THREE from 'three';
import { type EntityGuideLineStyle, EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';
import { entitySelectedOnlyFlag } from '@/entity/selection/entity_selection_state.js';
import { EntityVisualPointBox } from '@/entity/visual/entity_visual_point_box.js';
import { EntityVisualShapes } from '@/entity/visual/entity_visual_shapes.js';
import type { LightSettings } from '@/light/model/light_settings.js';
import { LightVisualFog } from '@/light/visual/light_visual_fog.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** Opacity of the box and icon of a disabled light. */
const LIGHT_DISABLED_OPACITY = 0.35;

/** Widest spot cone the guide lines draw, in degrees. */
const LIGHT_CONE_MAX_DEGREES = 179;

/** Lines drawn along a spot cone's side. */
const LIGHT_SPOT_SIDE_LINES = 8;

/** Opacity of range and cone lines. */
const LIGHT_GUIDE_OPACITY = 0.4;

/** Unit X axis shared by the guide shapes; never modified. */
const LIGHT_AXIS_X = new THREE.Vector3(1, 0, 0);

/** Unit Y axis shared by the guide shapes; never modified. */
const LIGHT_AXIS_Y = new THREE.Vector3(0, 1, 0);

/** Unit Z axis shared by the guide shapes; never modified. */
const LIGHT_AXIS_Z = new THREE.Vector3(0, 0, 1);

/**
 * Builds and refreshes the editor-only visuals of a light owner: a clickable
 * box with a camera-facing icon tinted with the light color and, while the
 * light is selected, range circles, a spot cone along −Z and the outline of its
 * fog volume.
 */
export class LightVisualBuilder {
  /**
   * Replaces every visual part of the owner with parts matching the settings.
   *
   * @param owner Light owner group.
   * @param settings Settings the visuals show.
   */
  static refresh(owner: THREE.Object3D, settings: LightSettings): void {
    EntityVisualBuilder.guidesRemove(owner);
    EntityVisualPointBox.ensure(owner, {
      name: 'Light Marker',
      iconName: LightVisualBuilder.iconNameOf(settings),
      colorHex: settings.colorHex,
      opacity: settings.enabled ? 1 : LIGHT_DISABLED_OPACITY,
    });
    LightVisualBuilder.guidesAdd(owner, settings);
  }

  /**
   * Adds the range circles, the spot cone and the fog outline, drawn only while
   * the light is selected.
   *
   * @param owner Light owner group.
   * @param settings Settings the guides show.
   */
  private static guidesAdd(owner: THREE.Object3D, settings: LightSettings): void {
    const guides = [LightVisualBuilder.rangeCreate(settings)];
    if (settings.kind === 'spot') {
      guides.push(LightVisualBuilder.coneCreate(settings));
    }
    if (settings.fogEnabled) {
      guides.push(LightVisualFog.outlineCreate(settings));
    }
    for (const guide of guides) {
      owner.add(guide);
      entitySelectedOnlyFlag(guide, owner);
    }
  }

  /**
   * Returns the icon of a light: a bulb for point lights and a beam for spots.
   *
   * @param settings Light settings.
   * @returns Icon name.
   */
  static iconNameOf(settings: LightSettings): IconName {
    return settings.kind === 'spot' ? 'spotlight-beam' : 'lightbulb';
  }

  /**
   * Returns the guide line style of a light.
   *
   * @param settings Light settings.
   * @returns Translucent solid lines in the light color.
   */
  private static guideStyle(settings: LightSettings): EntityGuideLineStyle {
    return { colorHex: settings.colorHex, opacity: LIGHT_GUIDE_OPACITY, dashed: false };
  }

  /**
   * Creates three orthogonal circles showing the light's radius.
   *
   * @param settings Light settings.
   * @returns Line segments object.
   */
  private static rangeCreate(settings: LightSettings): THREE.LineSegments {
    const points: THREE.Vector3[] = [];
    const center = new THREE.Vector3();
    EntityVisualShapes.circleAppend(points, center, LIGHT_AXIS_X, LIGHT_AXIS_Y, settings.radius);
    EntityVisualShapes.circleAppend(points, center, LIGHT_AXIS_X, LIGHT_AXIS_Z, settings.radius);
    EntityVisualShapes.circleAppend(points, center, LIGHT_AXIS_Y, LIGHT_AXIS_Z, settings.radius);
    return EntityVisualBuilder.linesCreate(points, LightVisualBuilder.guideStyle(settings), 'Light Range');
  }

  /**
   * Creates the spot cone: side lines from the light to the outer cutoff
   * circle, plus the inner cutoff circle. Both circles lie on the range sphere,
   * so cones wider than 90° open behind the light.
   *
   * @param settings Spot light settings.
   * @returns Line segments object.
   */
  private static coneCreate(settings: LightSettings): THREE.LineSegments {
    const points: THREE.Vector3[] = [];
    const outer = THREE.MathUtils.degToRad(Math.min(settings.outerCutoffDegrees, LIGHT_CONE_MAX_DEGREES));
    const inner = THREE.MathUtils.degToRad(Math.min(settings.innerCutoffDegrees, LIGHT_CONE_MAX_DEGREES));
    const outerCenter = new THREE.Vector3(0, 0, -settings.radius * Math.cos(outer));
    const outerRadius = settings.radius * Math.sin(outer);
    EntityVisualShapes.circleAppend(points, outerCenter, LIGHT_AXIS_X, LIGHT_AXIS_Y, outerRadius);
    const innerCenter = new THREE.Vector3(0, 0, -settings.radius * Math.cos(inner));
    EntityVisualShapes.circleAppend(points, innerCenter, LIGHT_AXIS_X, LIGHT_AXIS_Y, settings.radius * Math.sin(inner));
    const apex = new THREE.Vector3();
    EntityVisualShapes.spokesAppend(
      points,
      apex,
      outerCenter,
      LIGHT_AXIS_X,
      LIGHT_AXIS_Y,
      outerRadius,
      LIGHT_SPOT_SIDE_LINES,
    );
    return EntityVisualBuilder.linesCreate(points, LightVisualBuilder.guideStyle(settings), 'Light Cone');
  }
}
