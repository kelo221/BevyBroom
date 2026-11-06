import * as THREE from 'three';
import { CommandTransformRotationSet } from '@/transform/commands/command_transform_rotation_set.js';
import { panelPropertiesAreObjectRotationsUnchanged } from '@/ui/properties/panel_properties_numbers.js';
import { filterUnlockedObjects } from '@/utils/object_lock.js';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import {
  AnglesPitchYawRollConversion,
  type AnglesPitchYawRoll,
  type AnglesPitchYawRollPartial,
} from '@/ui/object_properties/widgets/angles/angles_pitch_yaw_roll.js';

/**
 * Turns angle edits of the Object Properties dialog into rotation commands for
 * the unlocked edited objects and refreshes the editor after each one.
 */
export class ObjectPropertiesClassInfoAnglesApplier {
  private readonly context: ObjectPropertiesTabContext;

  /**
   * Creates the applier.
   *
   * @param context Tab context the rotation commands are pushed through.
   */
  constructor(context: ObjectPropertiesTabContext) {
    this.context = context;
  }

  /**
   * Reads the angles of every object.
   *
   * @param objects Objects to read.
   * @returns Angles in object order.
   */
  anglesRead(objects: readonly THREE.Object3D[]): AnglesPitchYawRoll[] {
    return objects.map((object) => AnglesPitchYawRollConversion.fromRotation(object.rotation));
  }

  /**
   * Applies an angle edit to every unlocked object as one rotation command.
   *
   * @param objects Edited objects.
   * @param edit Angles to set; null components keep each object's value.
   * @returns True when any rotation changed.
   */
  anglesApply(objects: readonly THREE.Object3D[], edit: AnglesPitchYawRollPartial): boolean {
    const editable = filterUnlockedObjects(objects);
    const rotations = editable.map((object) => this.rotationEdited(object, edit));
    return this.rotationsPush(editable, rotations);
  }

  /**
   * Turns every unlocked object toward a world point, keeping its roll.
   *
   * @param objects Edited objects.
   * @param targetWorldPosition Point the objects face afterwards.
   * @returns True when any rotation changed.
   */
  anglesPointAt(objects: readonly THREE.Object3D[], targetWorldPosition: THREE.Vector3): boolean {
    const editable = filterUnlockedObjects(objects);
    const rotations = editable.map((object) => {
      const aim = AnglesPitchYawRollConversion.pitchYawAlong(this.directionInParent(object, targetWorldPosition));
      return this.rotationEdited(object, aim ? { ...aim, roll: null } : { pitch: null, yaw: null, roll: null });
    });
    return this.rotationsPush(editable, rotations);
  }

  /**
   * Builds an object's rotation after an angle edit, in its own Euler order.
   *
   * @param object Edited object.
   * @param edit Angles to set.
   * @returns New rotation.
   */
  private rotationEdited(object: THREE.Object3D, edit: AnglesPitchYawRollPartial): THREE.Euler {
    const merged = AnglesPitchYawRollConversion.merge(AnglesPitchYawRollConversion.fromRotation(object.rotation), edit);
    return AnglesPitchYawRollConversion.toRotation(merged, object.rotation.order);
  }

  /**
   * Returns the direction from an object to a world point in the frame of the
   * object's parent.
   *
   * @param object Object that turns.
   * @param targetWorldPosition Point to face.
   * @returns Direction in parent space.
   */
  private directionInParent(object: THREE.Object3D, targetWorldPosition: THREE.Vector3): THREE.Vector3 {
    object.updateWorldMatrix(true, false);
    const direction = targetWorldPosition.clone().sub(object.getWorldPosition(new THREE.Vector3()));
    const parentQuaternion = object.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
    return direction.applyQuaternion(parentQuaternion.invert());
  }

  /**
   * Pushes the rotations as one command when they change anything.
   *
   * @param objects Rotated objects.
   * @param rotations New rotations in object order.
   * @returns True when a command was pushed.
   */
  private rotationsPush(objects: THREE.Object3D[], rotations: THREE.Euler[]): boolean {
    if (objects.length === 0 || panelPropertiesAreObjectRotationsUnchanged(objects, rotations)) {
      return false;
    }
    this.context.commandStack.push(new CommandTransformRotationSet(objects, rotations));
    this.context.afterTransformCommit(objects);
    return true;
  }
}
