import * as THREE from 'three';
import { EntityHandle, type EntityHandleSnap, type EntityHandleView } from '@/entity/handles/entity_handle.js';
import { ProceduralPartFrame } from '@/procedural/build/procedural_part_frame.js';
import type { ProceduralHandleSpanDefinition } from '@/procedural/generator/procedural_generator.js';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';

/**
 * Ball that sets a length across a line between two point parameters, such as
 * the width of an escalator: it sits beside the middle of the line at half the
 * length, and dragging it sets the length to twice its distance from the line,
 * snapped to the grid.
 */
export class ProceduralHandleSpan extends EntityHandle<ProceduralSettings> {
  readonly handleName: string;
  private readonly definition: ProceduralHandleSpanDefinition;

  /**
   * Creates the handle of one length parameter.
   *
   * @param definition Length field and the two point fields of its line.
   */
  constructor(definition: ProceduralHandleSpanDefinition) {
    super();
    this.definition = definition;
    this.handleName = definition.path;
  }

  /**
   * Returns the ball beside the middle of the line, in world space.
   *
   * @param view Owner and camera.
   * @param settings Current valid settings.
   * @returns World position of the ball.
   */
  worldPositionFor(view: EntityHandleView, settings: ProceduralSettings): THREE.Vector3 {
    const half = ProceduralParametersRead.number(settings.parameters, this.definition.path) / 2;
    const local = this.middleOf(settings).addScaledVector(this.acrossOf(settings), half);
    return view.owner.localToWorld(local);
  }

  /**
   * Returns the plane through the ball that faces the camera.
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
   * Returns the settings with the length set to twice the ball's distance from
   * the line, measured across it.
   *
   * @param view Owner and camera of the dragging pane.
   * @param settingsAtStart Settings when the drag began.
   * @param handleWorld Where the ball is dragged to.
   * @param snap Snapping applied to the length.
   * @returns Settings with the new length, before sanitizing.
   */
  settingsDragged(
    view: EntityHandleView,
    settingsAtStart: ProceduralSettings,
    handleWorld: THREE.Vector3,
    snap: EntityHandleSnap,
  ): ProceduralSettings {
    const local = view.owner.worldToLocal(handleWorld.clone()).sub(this.middleOf(settingsAtStart));
    const length = snap.snapValue(Math.abs(local.dot(this.acrossOf(settingsAtStart))) * 2);
    return {
      ...settingsAtStart,
      parameters: { ...settingsAtStart.parameters, [this.definition.path]: length },
    };
  }

  /**
   * Returns the middle of the line in owner space.
   *
   * @param settings Valid settings.
   * @returns Owner-space point.
   */
  private middleOf(settings: ProceduralSettings): THREE.Vector3 {
    const start = ProceduralParametersRead.vector3(settings.parameters, this.definition.lineStartPath);
    const end = ProceduralParametersRead.vector3(settings.parameters, this.definition.lineEndPath);
    return start.add(end).multiplyScalar(0.5);
  }

  /**
   * Returns the horizontal direction across the line.
   *
   * @param settings Valid settings.
   * @returns Unit direction in owner space.
   */
  private acrossOf(settings: ProceduralSettings): THREE.Vector3 {
    const start = ProceduralParametersRead.vector3(settings.parameters, this.definition.lineStartPath);
    const end = ProceduralParametersRead.vector3(settings.parameters, this.definition.lineEndPath);
    return ProceduralPartFrame.acrossDirectionOf(end.sub(start));
  }
}
