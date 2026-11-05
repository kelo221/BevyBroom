import * as THREE from 'three';
import { styleFloatingPanelChromeButton } from '@/ui/floating_panel/panel_floating_title_bar.js';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { ObjectPropertiesTabSection } from '@/ui/object_properties/tabs/object_properties_tab_section.js';
import { WidgetAnglesCompass } from '@/ui/object_properties/widgets/widget_angles_compass.js';
import type { AnglesPitchYawRollPartial } from '@/ui/object_properties/widgets/angles/angles_pitch_yaw_roll.js';
import { ObjectPropertiesClassInfoChromePart } from './chrome/object_properties_class_info_chrome_part.js';
import { ObjectPropertiesClassInfoAnglesApplier } from './object_properties_class_info_angles_applier.js';

/**
 * Angles part of the Class Info tab: the compact angles combo with the yaw dial
 * and a Point At button that turns the edited objects toward an object picked
 * in the viewport.
 */
export class ObjectPropertiesClassInfoSectionAngles extends ObjectPropertiesTabSection {
  private readonly applier: ObjectPropertiesClassInfoAnglesApplier;
  private readonly compass: WidgetAnglesCompass;
  private objects: readonly THREE.Object3D[];

  /**
   * Creates the angles part.
   *
   * @param context Tab context the rotations are pushed through.
   */
  constructor(context: ObjectPropertiesTabContext) {
    super(context, 'Angles:', new ObjectPropertiesClassInfoChromePart());
    this.objects = [];
    this.applier = new ObjectPropertiesClassInfoAnglesApplier(context);
    this.compass = new WidgetAnglesCompass({ onAnglesCommit: (edit) => this.anglesCommit(edit) });
    this.element.append(this.compass.getElement(), this.pointAtButtonCreate());
  }

  /**
   * Shows the angles of the edited objects.
   *
   * @param objects Edited objects.
   */
  refresh(objects: readonly THREE.Object3D[]): void {
    this.objects = objects;
    this.compass.anglesWrite(this.applier.anglesRead(objects));
  }

  /**
   * Applies a compass edit and shows the resulting angles.
   *
   * @param edit Angles to set; null components keep each object's value.
   */
  private anglesCommit(edit: AnglesPitchYawRollPartial): void {
    this.applier.anglesApply(this.objects, edit);
    this.refresh(this.objects);
  }

  /**
   * Creates the Point At button that starts picking a target object.
   *
   * @returns Button element.
   */
  private pointAtButtonCreate(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Point At...';
    button.title = 'Click an object in a view to face it';
    button.dataset['objectPropertiesAction'] = 'point-at';
    button.style.alignSelf = 'flex-start';
    styleFloatingPanelChromeButton(button);
    button.addEventListener('click', () => this.context.objectPickBegin((target) => this.pointAtTarget(target)));
    return button;
  }

  /**
   * Turns the edited objects toward the picked object.
   *
   * @param target Picked object.
   */
  private pointAtTarget(target: THREE.Object3D): void {
    target.updateWorldMatrix(true, false);
    this.applier.anglesPointAt(this.objects, target.getWorldPosition(new THREE.Vector3()));
    this.refresh(this.objects);
  }
}
