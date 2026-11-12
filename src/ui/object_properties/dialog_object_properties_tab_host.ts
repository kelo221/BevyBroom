import type * as THREE from 'three';
import { TabBook } from '@/ui/tabs/tab_book.js';
import type {
  ObjectPropertiesTabContext,
  ObjectPropertiesTabInstance,
  ObjectPropertiesTabRegistration,
} from '@/ui/object_properties/registry/registry_object_properties_tab.js';

/** Tab context without the page container, shared by every tab. */
export type DialogObjectPropertiesTabContextShared = Omit<ObjectPropertiesTabContext, 'container'>;

/** A registered tab together with the instance mounted from it. */
interface DialogObjectPropertiesTabMounted {
  readonly registration: ObjectPropertiesTabRegistration;
  readonly instance: ObjectPropertiesTabInstance;
}

/**
 * Tab book of the Object Properties dialog: mounts one page per registered tab,
 * lists only the tabs that apply to the selection and forwards refresh,
 * deactivate and dispose to the mounted tabs.
 */
export class DialogObjectPropertiesTabHost {
  private readonly tabBook: TabBook;
  private readonly mountedTabs: readonly DialogObjectPropertiesTabMounted[];

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
    this.mountedTabs = registrations.map((registration) => this.tabMount(registration, sharedContext));
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
   * Lists or hides each tab for the edited objects, then refreshes the tabs
   * that apply to them.
   *
   * @param objects Edited objects.
   */
  refresh(objects: readonly THREE.Object3D[]): void {
    this.mountedTabs.forEach((mounted) => this.mountedTabRefresh(mounted, objects));
  }

  /** Lets every tab release what it borrowed while the dialog was open. */
  deactivate(): void {
    this.mountedTabs.forEach((mounted) => mounted.instance.deactivate?.());
  }

  /** Disposes every tab and the tab book. */
  dispose(): void {
    this.mountedTabs.forEach((mounted) => mounted.instance.dispose());
    this.tabBook.dispose();
  }

  /**
   * Updates the listing of one tab for the edited objects and refreshes it when
   * it applies. A tab that does not apply is not refreshed, and is refreshed
   * again the next time it applies.
   *
   * @param mounted Mounted tab.
   * @param objects Edited objects.
   */
  private mountedTabRefresh(mounted: DialogObjectPropertiesTabMounted, objects: readonly THREE.Object3D[]): void {
    const isApplying = mounted.registration.appliesToIs?.(objects) ?? true;
    this.tabBook.tabVisibleSet(mounted.registration.id, isApplying);
    if (isApplying) {
      mounted.instance.refresh(objects);
    }
  }

  /**
   * Creates the page of one tab, adds it to the tab book and mounts the tab.
   *
   * @param registration Tab registration.
   * @param sharedContext Context shared by every tab.
   * @returns Registration with its mounted tab.
   */
  private tabMount(
    registration: ObjectPropertiesTabRegistration,
    sharedContext: DialogObjectPropertiesTabContextShared,
  ): DialogObjectPropertiesTabMounted {
    const page = document.createElement('div');
    page.className = 'dialog-object-properties-page';
    page.dataset['objectPropertiesTab'] = registration.id;
    page.style.display = 'flex';
    page.style.flexDirection = 'column';
    this.tabBook.tabAdd({ id: registration.id, label: registration.label, pageResolve: () => page });
    return { registration, instance: registration.mount({ ...sharedContext, container: page }) };
  }
}
