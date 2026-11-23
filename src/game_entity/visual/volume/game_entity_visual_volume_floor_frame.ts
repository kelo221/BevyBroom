import * as THREE from 'three';
import {
  type GameEntityVolumeRunAxis,
  GameEntityVisualVolumeRunLayout,
} from '@/game_entity/visual/volume/game_entity_visual_volume_run_layout.js';

/** Distance, in local units, a plan drawing sits above the face it lies on. */
const GAME_ENTITY_VOLUME_PLAN_LIFT = 0.02;

/**
 * Face of a volume its plan drawing lies on: the floor, seen from inside the
 * volume, or the roof, seen from above.
 */
export type GameEntityVolumePlanLevel = 'floor' | 'roof';

/**
 * A volume's floor plan in its local space, measured along the run axis and the
 * other horizontal axis (the cross axis), lying just above its floor or its
 * roof.
 */
export class GameEntityVisualVolumeFloorFrame {
  readonly axis: GameEntityVolumeRunAxis;
  readonly axisMin: number;
  readonly axisMax: number;
  readonly crossMin: number;
  readonly crossMax: number;
  readonly floorHeight: number;

  /**
   * Creates the floor frame of a volume.
   *
   * @param localBounds Volume bounds in its local space.
   * @param scale Local scale of the volume.
   * @param level Face the drawing lies on.
   */
  constructor(localBounds: THREE.Box3, scale: THREE.Vector3, level: GameEntityVolumePlanLevel) {
    this.axis = GameEntityVisualVolumeRunLayout.axisOf(localBounds, scale);
    const crossAxis = this.axis === 'x' ? 'z' : 'x';
    this.axisMin = localBounds.min[this.axis];
    this.axisMax = localBounds.max[this.axis];
    this.crossMin = localBounds.min[crossAxis];
    this.crossMax = localBounds.max[crossAxis];
    this.floorHeight = (level === 'floor' ? localBounds.min.y : localBounds.max.y) + GAME_ENTITY_VOLUME_PLAN_LIFT;
  }

  /**
   * Returns the floor's length along the run axis.
   *
   * @returns Length in local units.
   */
  axisLength(): number {
    return this.axisMax - this.axisMin;
  }

  /**
   * Returns the floor's length along the cross axis.
   *
   * @returns Length in local units.
   */
  crossLength(): number {
    return this.crossMax - this.crossMin;
  }

  /**
   * Returns the cross axis coordinate at a share of the floor's width.
   *
   * @param share Zero at the cross axis's negative edge, one at its positive.
   * @returns Local cross axis coordinate.
   */
  crossAt(share: number): number {
    return this.crossMin + this.crossLength() * share;
  }

  /**
   * Creates the group floor drawings go into, lying on the floor. Inside it
   * local X and Y are the floor's X and -Z.
   *
   * @returns Floor group.
   */
  floorGroupCreate(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(0, this.floorHeight, 0);
    group.rotation.x = -Math.PI / 2;
    return group;
  }

  /**
   * Places a flat drawing made along X for the run axis and Y for the cross
   * axis at a floor point, turned so its X follows the run axis.
   *
   * @param drawing Drawing inside the floor group.
   * @param axisPosition Local coordinate along the run axis.
   * @param crossPosition Local coordinate along the cross axis.
   */
  drawingPlace(drawing: THREE.Object3D, axisPosition: number, crossPosition: number): void {
    if (this.axis === 'x') {
      drawing.position.set(axisPosition, -crossPosition, 0);
      drawing.rotation.z = 0;
      return;
    }
    drawing.position.set(crossPosition, -axisPosition, 0);
    drawing.rotation.z = -Math.PI / 2;
  }

  /**
   * Returns the end points, in floor group space, of a line across the floor at
   * a run axis coordinate.
   *
   * @param axisPosition Local coordinate along the run axis.
   * @returns The line's two ends.
   */
  crossLineAt(axisPosition: number): [THREE.Vector3, THREE.Vector3] {
    const point = (crossPosition: number): THREE.Vector3 =>
      this.axis === 'x'
        ? new THREE.Vector3(axisPosition, -crossPosition, 0)
        : new THREE.Vector3(crossPosition, -axisPosition, 0);
    return [point(this.crossMin), point(this.crossMax)];
  }
}
