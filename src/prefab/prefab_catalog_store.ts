import type * as THREE from 'three';
import { PrefabSerializer } from './prefab_serializer.js';
import type { PrefabTemplate } from './prefab_types.js';

/** Listener notified when the Prefab catalog changes. */
export type PrefabCatalogStoreListener = () => void;

/**
 * Stores categorized `PrefabTemplate` definitions for Hammer++'s Prefab
 * `Categories / Objects` picker and `Create Prefab` workflow.
 */
export class PrefabCatalogStore {
  private readonly templates: Map<string, PrefabTemplate>;
  private readonly listeners: Set<PrefabCatalogStoreListener>;
  private nextStampCounter: number;
  private nextTemplateCounter: number;

  /** Creates a Prefab catalog store. */
  constructor() {
    this.templates = new Map();
    this.listeners = new Set();
    this.nextStampCounter = 1;
    this.nextTemplateCounter = 1;
  }

  /**
   * Registers or replaces a prefab template in the catalog.
   *
   * @param template Prefab template to add.
   */
  templateAdd(template: PrefabTemplate): void {
    this.templates.set(template.id, template);
    this.listenersNotify();
  }

  /**
   * Captures live scene objects into a new prefab template with a fresh id
   * without adding it to the catalog.
   *
   * @param name Display name of the new prefab.
   * @param category Category name.
   * @param objects Root scene objects to capture.
   * @returns Captured `PrefabTemplate`.
   */
  templateCapture(name: string, category: string, objects: readonly THREE.Object3D[]): PrefabTemplate {
    const id = `prefab_${this.nextTemplateCounter++}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    return PrefabSerializer.captureObjects(id, name, category, objects);
  }

  /**
   * Removes a prefab template by id.
   *
   * @param id Template id.
   * @returns True when removed.
   */
  templateRemove(id: string): boolean {
    const deleted = this.templates.delete(id);
    if (deleted) {
      this.listenersNotify();
    }
    return deleted;
  }

  /**
   * Finds a prefab template by id.
   *
   * @param id Template id.
   * @returns Matching template, or null.
   */
  templateFind(id: string): PrefabTemplate | null {
    return this.templates.get(id) ?? null;
  }

  /**
   * Lists all distinct prefab categories in insertion order.
   *
   * @returns Category names.
   */
  categoriesRead(): string[] {
    const seen = new Set<string>();
    this.templates.forEach((tpl) => seen.add(tpl.category));
    if (seen.size === 0) {
      seen.add('Prefabs');
    }
    return [...seen];
  }

  /**
   * Lists all prefab templates belonging to `category`.
   *
   * @param category Category name.
   * @returns Matching prefab templates.
   */
  templatesByCategoryRead(category: string): PrefabTemplate[] {
    const list: PrefabTemplate[] = [];
    this.templates.forEach((tpl) => {
      if (tpl.category === category) {
        list.push(tpl);
      }
    });
    return list;
  }

  /**
   * Stamps a prefab template at `targetOrigin` with an auto-incrementing scope
   * suffix.
   *
   * @param id Template id.
   * @param targetOrigin World position.
   * @param scoped Whether to scope internal Entity I/O names (`true` by
   *   default).
   * @returns Instantiated group, or null when template id is unknown.
   */
  stampTemplate(id: string, targetOrigin: THREE.Vector3, scoped: boolean = true): THREE.Group | null {
    const template = this.templateFind(id);
    if (!template) {
      return null;
    }
    const suffix = scoped ? `inst${this.nextStampCounter++}` : '';
    return PrefabSerializer.instantiateTemplate(template, targetOrigin, suffix);
  }

  /**
   * Subscribes to catalog changes.
   *
   * @param listener Change callback.
   * @returns Unsubscribe function.
   */
  changeListenerAdd(listener: PrefabCatalogStoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Notifies all registered listeners. */
  private listenersNotify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

let sharedPrefabCatalogStore: PrefabCatalogStore | null = null;

/**
 * Returns the shared Prefab catalog store singleton.
 *
 * @returns Shared PrefabCatalogStore.
 */
export function getPrefabCatalogStore(): PrefabCatalogStore {
  if (!sharedPrefabCatalogStore) {
    sharedPrefabCatalogStore = new PrefabCatalogStore();
  }
  return sharedPrefabCatalogStore;
}
