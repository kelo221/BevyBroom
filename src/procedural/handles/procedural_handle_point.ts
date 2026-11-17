import * as THREE from 'three';
import { EntityHandle, type EntityHandleSnap, type EntityHandleView } from '@/entity/handles/entity_handle.js';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';

/**
 * Ball on one point parameter of a procedural object, such as a box corner or
 * the end of an escalator. It moves on the plane facing the camera, and its
 * world position snaps to the grid like a brush vertex.
 */
export class ProceduralHandlePoint extends EntityHandle<ProceduralSettings> {
  readonly handleName: string;
  private readonly parameterPath: string;

  /**
   * Creates the handle of one point parameter.
   *
   * @param parameterPath Path of a vector3 field holding a point in owner
   *   space.
   */
  constructor(parameterPath: string) {
    super();
    this.parameterPath = parameterPath;
    this.handleName = parameterPath;
  }

  /**
   * Returns the point in world space.
   *
   * @param view Owner and camera.
   * @param settings Current valid settings.
   * @returns World position of the ball.
   */
  worldPositionFor(view: EntityHandleView, settings: ProceduralSettings): THREE.Vector3 {
    return view.owner.localToWorld(ProceduralParametersRead.vector3(settings.parameters, this.parameterPath));
  }

  /**
   * Returns the plane through the point that faces the camera.
   *
   * @param view Owner and camera of the dragging pane.
   * @param settings Settings when the drag began.
   * @returns Drag plane.
   */
  dragPlaneFor(view: EntityHandleView, settings: ProceduralSettings): THREE.Plane {
    const point = this.worldPositionFor(view, settings);
    return new THREE.Plane().setFromNormalAndCoplanarPoint(EntityHandle.viewDirectionAt(view.camera, point), point);
  }

  /**
   * Returns the settings with the point moved to the grid-snapped drag
   * position.
   *
   * @param view Owner and camera of the dragging pane.
   * @param settingsAtStart Settings when the drag began.
   * @param handleWorld Where the ball is dragged to.
   * @param snap Snapping applied to every world coordinate.
   * @returns Settings with the moved point.
   */
  settingsDragged(
    view: EntityHandleView,
    settingsAtStart: ProceduralSettings,
    handleWorld: THREE.Vector3,
    snap: EntityHandleSnap,
  ): ProceduralSettings {
    const snappedWorld = new THREE.Vector3(
      snap.snapValue(handleWorld.x),
      snap.snapValue(handleWorld.y),
      snap.snapValue(handleWorld.z),
    );
    const local = view.owner.worldToLocal(snappedWorld);
    return {
      ...settingsAtStart,
      parameters: { ...settingsAtStart.parameters, [this.parameterPath]: ProceduralParametersRead.vector3Value(local) },
    };
  }
}
