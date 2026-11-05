import type * as THREE from 'three';
import { TabBook } from '@/ui/tabs/tab_book.js';
import type {
  ObjectPropertiesTabContext,
  ObjectPropertiesTabInstance,
  ObjectPropertiesTabRegistration,
} from '@/ui/object_properties/registry/registry_object_properties_tab.js';

/** Tab context without the page container, shared by every tab. */
export type DialogObjectPropertiesTabContextShared = Omit<ObjectPropertiesTabContext, 'container'>;

/**
 * Tab book of the Object Properties dialog: mounts one page per registered tab
 * and forwards refresh, deactivate and dispose to the mounted tabs.
 */
export class DialogObjectPropertiesTabHost {
  private readonly tabBook: TabBook;
  private readonly instances: ObjectPropertiesTabInstance[];

  /**
   * Mounts every registered tab.
   *
   * @param registrations Tabs in display order.
   * @param sharedContext Context every tab receives besides its page.
   */
  constructor(
    registrations: readonly ObjectPropertiesTabRegistration[],
    sharedContext: DialogObjectPropertiesTabContextShared,
  ) {
    this.tabBook = new TabBook({ ariaLabel: 'Object Properties tabs', variant: 'compact' });
    this.instances = registrations.map((registration) => this.tabMount(registration, sharedContext));
  }

  /**
   * Returns the tab book root.
   *
   * @returns Tab book element.
   */
  getElement(): HTMLElement {
    return this.tabBook.getElement();
  }

  /**
   * Returns the tab book.
   *
   * @returns Tab book.
   */
  tabBookRead(): TabBook {
    return this.tabBook;
  }

  /**
   * Refreshes every tab for the edited objects.
   *
   * @param objects Edited objects.
   */
  refresh(objects: readonly THREE.Object3D[]): void {
    this.instances.forEach((instance) => instance.refresh(objects));
  }

  /** Lets every tab release what it borrowed while the dialog was open. */
  deactivate(): void {
    this.instances.forEach((instance) => instance.deactivate?.());
  }

  /** Disposes every tab and the tab book. */
  dispose(): void {
    this.instances.forEach((instance) => instance.dispose());
    this.tabBook.dispose();
  }

  /**
   * Creates the page of one tab, adds it to the tab book and mounts the tab.
   *
   * @param registration Tab registration.
   * @param sharedContext Context shared by every tab.
   * @returns Mounted tab.
   */
  private tabMount(
    registration: ObjectPropertiesTabRegistration,
    sharedContext: DialogObjectPropertiesTabContextShared,
  ): ObjectPropertiesTabInstance {
    const page = document.createElement('div');
    page.className = 'dialog-object-properties-page';
    page.dataset['objectPropertiesTab'] = registration.id;
    page.style.display = 'flex';
    page.style.flexDirection = 'column';
    this.tabBook.tabAdd({ id: registration.id, label: registration.label, pageResolve: () => page });
    return registration.mount({ ...sharedContext, container: page });
  }
}
