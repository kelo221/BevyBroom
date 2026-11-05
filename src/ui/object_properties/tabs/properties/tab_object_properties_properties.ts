import type * as THREE from 'three';
import type {
  ObjectPropertiesTabContext,
  ObjectPropertiesTabInstance,
  ObjectPropertiesTabRegistration,
} from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import type { PanelProperties } from '@/ui/properties/panel_properties.js';
import type { PanelPropertiesSection } from '@/ui/properties/panel_properties_section.js';
import { listItemsIdentical } from '@/utils/utils_list.js';

/**
 * Properties tab of the Object Properties dialog: hosts the editor's shared
 * properties panel (transform, material, bevel and other registered sections)
 * on the dialog's edited objects and command stack while the dialog is open,
 * leaving keyvalue sections to the Class Info tab, and hands it back when the
 * dialog closes.
 */
export class TabObjectPropertiesProperties implements ObjectPropertiesTabInstance {
  private readonly context: ObjectPropertiesTabContext;

  /**
   * Creates the tab; the panel is attached on the first refresh.
   *
   * @param context Tab context providing the shared panel.
   */
  constructor(context: ObjectPropertiesTabContext) {
    this.context = context;
  }

  /**
   * Attaches the shared panel to the tab on the edited objects, or, when it is
   * already attached, re-reads its values or binds it to changed objects.
   *
   * @param selectedObjects Edited objects.
   */
  refresh(selectedObjects: readonly THREE.Object3D[]): void {
    const panel = this.context.propertiesPanelRead();
    if (!panel) {
      return;
    }
    if (panel.getContainer().parentElement !== this.context.container) {
      this.panelAttach(panel, selectedObjects);
      return;
    }
    if (listItemsIdentical(panel.boundObjectsRead(), selectedObjects)) {
      panel.refreshBoundObject();
      return;
    }
    panel.bindObjects([...selectedObjects]);
  }

  /** Detaches the shared panel when the dialog closes. */
  deactivate(): void {
    const panel = this.context.propertiesPanelRead();
    if (panel?.getContainer().parentElement === this.context.container) {
      panel.hostDetach();
    }
  }

  /** Detaches the shared panel. */
  dispose(): void {
    this.deactivate();
  }

  /**
   * Returns the registration of the Properties tab.
   *
   * @returns Tab registration.
   */
  static registrationCreate(): ObjectPropertiesTabRegistration {
    return {
      id: 'properties',
      label: 'Properties',
      order: 45,
      mount: (context) => new TabObjectPropertiesProperties(context),
    };
  }

  /**
   * Moves the shared panel into the tab, pinned to the edited objects and
   * pushing onto the tab's command stack, and lets it fill the tab width.
   *
   * @param panel Shared properties panel.
   * @param selectedObjects Edited objects.
   */
  private panelAttach(panel: PanelProperties, selectedObjects: readonly THREE.Object3D[]): void {
    const panelRoot = panel.getContainer();
    panelRoot.style.width = 'auto';
    panelRoot.style.minWidth = '0';
    panelRoot.style.borderLeft = 'none';
    panel.hostAttach(this.context.container, {
      pinnedObjects: selectedObjects,
      commandStack: this.context.commandStack,
      sectionShown: (section) => TabObjectPropertiesProperties.sectionShownInTab(section),
    });
  }

  /**
   * Returns whether the tab shows a registered panel section; keyvalue sections
   * such as lights and game components are edited in the Class Info tab.
   *
   * @param section Registered panel section.
   * @returns False for keyvalue sections.
   */
  private static sectionShownInTab(section: PanelPropertiesSection): boolean {
    return section.keyvaluesSectionIs?.() !== true;
  }
}
