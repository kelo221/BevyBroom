import type * as THREE from 'three';
import {
  MODIFIER_STACK_OBJECT_PROPERTIES_TAB_ID,
  PanelPropertiesModifierStackSection,
} from '@/modifier/stack/ui/panel_properties_modifier_stack_section.js';
import type {
  ObjectPropertiesTabContext,
  ObjectPropertiesTabInstance,
  ObjectPropertiesTabRegistration,
} from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { objectPropertiesTabAppliesToVolumesIs } from '@/ui/object_properties/registry/object_properties_tab_applies_to.js';
import { PanelPropertiesChrome } from '@/ui/properties/panel_properties_chrome.js';

/**
 * Modifiers tab of the Object Properties dialog: the modifier stack of the
 * edited modifier volume. It is listed only when every edited object is a
 * volume.
 */
export class TabObjectPropertiesModifiers implements ObjectPropertiesTabInstance {
  private readonly stackSection: PanelPropertiesModifierStackSection;

  /**
   * Builds the stack section into the tab container, editing through the
   * dialog's command stack.
   *
   * @param context Tab context the stack edits are pushed through.
   */
  constructor(context: ObjectPropertiesTabContext) {
    const chrome = new PanelPropertiesChrome();
    this.stackSection = new PanelPropertiesModifierStackSection(
      chrome.createSectionContainer,
      chrome.createSectionHeader,
    );
    this.stackSection.setCommandStack(context.commandStack);
    this.stackSection.setSceneChanged(context.markDirty);
    context.container.appendChild(this.stackSection.getElement());
  }

  /**
   * Shows the stack of the single edited volume, or the volume-only notice when
   * several volumes are edited.
   *
   * @param selectedObjects Edited objects.
   */
  refresh(selectedObjects: readonly THREE.Object3D[]): void {
    this.stackSection.updateFromObjects(selectedObjects);
  }

  /**
   * Clears the stack so the edited volume's helpers are hidden while the tab is
   * away.
   */
  deactivate(): void {
    this.stackSection.updateFromObjects([]);
  }

  /** Clears the stack and removes the section from the tab container. */
  dispose(): void {
    this.deactivate();
    this.stackSection.getElement().remove();
  }

  /**
   * Returns the registration of the Modifiers tab, listed for modifier volumes.
   *
   * @returns Tab registration.
   */
  static registrationCreate(): ObjectPropertiesTabRegistration {
    return {
      id: MODIFIER_STACK_OBJECT_PROPERTIES_TAB_ID,
      label: 'Modifiers',
      order: 46,
      mount: (context) => new TabObjectPropertiesModifiers(context),
      appliesToIs: objectPropertiesTabAppliesToVolumesIs,
    };
  }
}
