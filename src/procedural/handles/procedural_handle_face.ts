import * as THREE from 'three';
import { EntityHandle, type EntityHandleSnap, type EntityHandleView } from '@/entity/handles/entity_handle.js';
import { entityHandleAxisDragPlane } from '@/entity/handles/entity_handle_axis.js';
import type { ProceduralHandleFaceDefinition } from '@/procedural/generator/procedural_generator.js';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';

/**
 * Handle in the middle of one face of a box spanned by two corner fields, with
 * an arrow along the face's outward normal. Dragging it moves only that face
 * along its normal, snapped to the grid, and never past the opposite face.
 */
export class ProceduralHandleFace extends EntityHandle<ProceduralSettings> {
  readonly handleName: string;
  private readonly definition: ProceduralHandleFaceDefinition;

  /**
   * Creates the handle of one box face.
   *
   * @param definition Corner fields, axis, side and smallest size.
   */
  constructor(definition: ProceduralHandleFaceDefinition) {
    super();
    this.definition = definition;
    this.handleName = `${definition.cornerAPath}:${definition.cornerBPath}:${definition.side}_${definition.axis}`;
  }

  /**
   * Returns the middle of the face in world space.
   *
   * @param view Owner and camera.
   * @param settings Current valid settings.
   * @returns World position of the handle.
   */
  worldPositionFor(view: EntityHandleView, settings: ProceduralSettings): THREE.Vector3 {
    const box = this.boxOf(settings);
    const center = box.getCenter(new THREE.Vector3());
    center[this.definition.axis] = box[this.definition.side][this.definition.axis];
    return view.owner.localToWorld(center);
  }

  /**
   * Returns the face's outward normal in world space as the handle's only
   * arrow.
   *
   * @param view Owner and camera.
   * @param settings Current valid settings.
   * @returns One unit world direction.
   */
  override axesFor(view: EntityHandleView, settings: ProceduralSettings): readonly THREE.Vector3[] {
    void settings;
    return [this.normalWorldOf(view.owner)];
  }

  /**
   * Returns a plane holding the normal line through the handle that faces the
   * camera, so dragging the ball also slides the face along its normal.
   *
   * @param view Owner and camera of the dragging pane.
   * @param settings Settings when the drag began.
   * @returns Drag plane.
   */
  dragPlaneFor(view: EntityHandleView, settings: ProceduralSettings): THREE.Plane {
    const point = this.worldPositionFor(view, settings);
    const normal = this.normalWorldOf(view.owner);
    return entityHandleAxisDragPlane(point, normal, EntityHandle.viewDirectionAt(view.camera, point));
  }

  /**
   * Returns the settings with the face moved to the grid-snapped position of
   * the dragged handle along the face's axis.
   *
   * @param view Owner and camera of the dragging pane.
   * @param settingsAtStart Settings when the drag began.
   * @param handleWorld Where the handle is dragged to.
   * @param snap Snapping applied to world coordinates.
   * @returns Settings with the moved face.
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
    const faceCoordinate = view.owner.worldToLocal(snappedWorld)[this.definition.axis];
    return this.settingsWithFaceAt(settingsAtStart, faceCoordinate);
  }

  /**
   * Returns the settings with this face at an owner-space coordinate, kept at
   * least the smallest size away from the opposite face.
   *
   * @param settings Settings to change.
   * @param faceCoordinate Wanted coordinate of the face on its axis.
   * @returns Changed settings.
   */
  private settingsWithFaceAt(settings: ProceduralSettings, faceCoordinate: number): ProceduralSettings {
    const { axis, side, minimumSize, cornerAPath, cornerBPath } = this.definition;
    const cornerA = ProceduralParametersRead.vector3(settings.parameters, cornerAPath);
    const cornerB = ProceduralParametersRead.vector3(settings.parameters, cornerBPath);
    const isCornerAOnSide = side === 'min' ? cornerA[axis] <= cornerB[axis] : cornerA[axis] > cornerB[axis];
    const moved = isCornerAOnSide ? cornerA : cornerB;
    const opposite = isCornerAOnSide ? cornerB : cornerA;
    moved[axis] =
      side === 'min'
        ? Math.min(faceCoordinate, opposite[axis] - minimumSize)
        : Math.max(faceCoordinate, opposite[axis] + minimumSize);
    const parameters = {
      ...settings.parameters,
      [cornerAPath]: ProceduralParametersRead.vector3Value(cornerA),
      [cornerBPath]: ProceduralParametersRead.vector3Value(cornerB),
    };
    return { ...settings, parameters };
  }

  /**
   * Returns the owner-space box spanned by the two corners.
   *
   * @param settings Valid settings.
   * @returns Box.
   */
  private boxOf(settings: ProceduralSettings): THREE.Box3 {
    return new THREE.Box3().setFromPoints([
      ProceduralParametersRead.vector3(settings.parameters, this.definition.cornerAPath),
      ProceduralParametersRead.vector3(settings.parameters, this.definition.cornerBPath),
    ]);
  }

  /**
   * Returns the face's outward normal in world space.
   *
   * @param owner Entity owner.
   * @returns Unit world direction.
   */
  private normalWorldOf(owner: THREE.Object3D): THREE.Vector3 {
    const local = new THREE.Vector3();
    local[this.definition.axis] = this.definition.side === 'min' ? -1 : 1;
    owner.updateWorldMatrix(true, false);
    return local.transformDirection(owner.matrixWorld);
  }
}
