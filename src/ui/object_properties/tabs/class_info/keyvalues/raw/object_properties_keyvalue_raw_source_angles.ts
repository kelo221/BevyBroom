import type * as THREE from 'three';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { AnglesPitchYawRollConversion } from '@/ui/object_properties/widgets/angles/angles_pitch_yaw_roll.js';
import { ObjectPropertiesClassInfoAnglesApplier } from '../../object_properties_class_info_angles_applier.js';
import type { ObjectPropertiesKeyvalueRawRow } from './object_properties_keyvalue_raw_row.js';
import { ObjectPropertiesKeyvalueRawSource } from './object_properties_keyvalue_raw_source.js';

/** The angles keyvalue: pitch, yaw and roll of the edited objects as text. */
export class ObjectPropertiesKeyvalueRawSourceAngles extends ObjectPropertiesKeyvalueRawSource {
  private readonly applier: ObjectPropertiesClassInfoAnglesApplier;

  /**
   * Creates the source.
   *
   * @param context Tab context the rotations are pushed through.
   */
  constructor(context: ObjectPropertiesTabContext) {
    super(context);
    this.applier = new ObjectPropertiesClassInfoAnglesApplier(context);
  }

  /**
   * Returns the angles row.
   *
   * @param objects Edited objects.
   * @returns One row with every object's angles.
   */
  rowsCreate(objects: readonly THREE.Object3D[]): ObjectPropertiesKeyvalueRawRow[] {
    return [
      {
        key: 'angles',
        label: 'Angles',
        helpText: 'Pitch, yaw and roll in degrees. A single number sets only the yaw.',
        valueTexts: this.applier.anglesRead(objects).map((angles) => AnglesPitchYawRollConversion.textFormat(angles)),
        commit: (text) => this.anglesCommit(objects, text),
      },
    ];
  }

  /**
   * Turns every unlocked object to the typed angles; unreadable text changes
   * nothing.
   *
   * @param objects Edited objects.
   * @param text Typed angles.
   */
  private anglesCommit(objects: readonly THREE.Object3D[], text: string): void {
    const edit = AnglesPitchYawRollConversion.textParse(text);
    if (edit) {
      this.applier.anglesApply(objects, edit);
    }
  }
}
