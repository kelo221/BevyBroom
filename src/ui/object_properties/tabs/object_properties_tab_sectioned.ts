import type * as THREE from 'three';
import type { ObjectPropertiesTabInstance } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import type { ObjectPropertiesTabSection } from './object_properties_tab_section.js';

/**
 * Object Properties tab that stacks sections in its container and forwards
 * refresh and dispose to each of them.
 */
export class ObjectPropertiesTabSectioned implements ObjectPropertiesTabInstance {
  private readonly sections: readonly ObjectPropertiesTabSection[];

  /**
   * Mounts the sections into the tab container in order.
   *
   * @param container Tab page element.
   * @param sections Sections shown from top to bottom.
   */
  constructor(container: HTMLElement, sections: readonly ObjectPropertiesTabSection[]) {
    this.sections = sections;
    container.append(...sections.map((section) => section.getElement()));
  }

  /**
   * Refreshes every section for the edited objects.
   *
   * @param selectedObjects Edited objects.
   */
  refresh(selectedObjects: readonly THREE.Object3D[]): void {
    this.sections.forEach((section) => section.refresh(selectedObjects));
  }

  /** Disposes every section. */
  dispose(): void {
    this.sections.forEach((section) => section.dispose());
  }
}
