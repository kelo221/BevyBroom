import type * as THREE from 'three';
import { ClipboardPayloadEncoder } from '@/clipboard/payload/clipboard_payload_encoder.js';
import type { ClipboardPayload } from '@/clipboard/payload/clipboard_payload_types.js';
import { prefabPayloadScope } from './payload/prefab_payload_scope.js';
import type { PrefabTemplate } from './prefab_types.js';

/** Listener notified when the Prefab catalog changes. */
export type PrefabCatalogStoreListener = () => void;

/** Keeps the prefabs of a catalog in files, such as those of the open project. */
export interface PrefabCatalogPersistence {
  /**
   * Saves a prefab that was added or replaced.
   *
   * @param template Prefab to save.
   */
  templateSave(template: PrefabTemplate): void;
  /**
   * Deletes the file of a removed prefab.
   *
   * @param template Removed prefab.
   */
  templateDelete(template: PrefabTemplate): void;
}

/** Category of prefabs created without one. */
export const PREFAB_CATEGORY_DEFAULT = 'Prefabs';

/**
 * Stores categorized `PrefabTemplate` definitions for Hammer++'s Prefab
 * `Categories / Objects` picker and `Create Prefab` workflow. With a
 * persistence attached, every added, replaced or removed prefab is saved or
 * deleted there too.
 */
export class PrefabCatalogStore {
  private readonly templates: Map<string, PrefabTemplate>;
  private readonly listeners: Set<PrefabCatalogStoreListener>;
  private persistence: PrefabCatalogPersistence | null;
  private persistedIds: Set<string>;
  private nextStampCounter: number;

  /** Creates an empty Prefab catalog store without persistence. */
  constructor() {
    this.templates = new Map();
    this.listeners = new Set();
    this.persistence = null;
    this.persistedIds = new Set();
    this.nextStampCounter = 1;
  }

  /**
   * Registers or replaces a prefab template and saves it to the persistence.
   *
   * @param template Prefab template to add.
   */
  templateAdd(template: PrefabTemplate): void {
    this.templates.set(template.id, template);
    if (this.persistence !== null) {
      this.persistedIds.add(template.id);
      this.persistence.templateSave(template);
    }
    this.listenersNotify();
  }

  /**
   * Captures live scene objects into a new prefab template with a fresh id
   * derived from its name, without adding it to the catalog.
   *
   * @param name Display name of the new prefab.
   * @param category Category name.
   * @param objects Root scene objects to capture.
   * @returns Captured template, or null when nothing capturable was given.
   */
  templateCapture(name: string, category: string, objects: readonly THREE.Object3D[]): PrefabTemplate | null {
    const payload = ClipboardPayloadEncoder.encode(objects);
    if (payload === null) {
      return null;
    }
    return { id: this.idAllocate(name), name, category: category.trim() || PREFAB_CATEGORY_DEFAULT, payload };
  }

  /**
   * Removes a prefab template by id and deletes it from the persistence that
   * holds it.
   *
   * @param id Template id.
   * @returns True when removed.
   */
  templateRemove(id: string): boolean {
    const template = this.templates.get(id);
    if (template === undefined) {
      return false;
    }
    this.templates.delete(id);
    if (this.persistence !== null && this.persistedIds.delete(id)) {
      this.persistence.templateDelete(template);
    }
    this.listenersNotify();
    return true;
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
   * Lists every prefab template in insertion order.
   *
   * @returns Templates.
   */
  templatesRead(): PrefabTemplate[] {
    return [...this.templates.values()];
  }

  /**
   * Returns whether a template is kept by the attached persistence.
   *
   * @param id Template id.
   * @returns True for persisted templates.
   */
  isPersisted(id: string): boolean {
    return this.persistence !== null && this.persistedIds.has(id);
  }

  /**
   * Attaches the persistence and shows the prefabs it holds, replacing the
   * prefabs of the persistence attached before; null detaches it and removes
   * its prefabs from the catalog. Nothing is saved or deleted while doing so.
   *
   * @param persistence Persistence to attach, or null.
   * @param templates Prefabs the persistence holds.
   */
  persistenceAttach(persistence: PrefabCatalogPersistence | null, templates: readonly PrefabTemplate[]): void {
    this.persistedIds.forEach((id) => this.templates.delete(id));
    this.persistence = persistence;
    this.persistedIds = new Set(persistence === null ? [] : templates.map((template) => template.id));
    if (persistence !== null) {
      templates.forEach((template) => this.templates.set(template.id, template));
    }
    this.listenersNotify();
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
      seen.add(PREFAB_CATEGORY_DEFAULT);
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
    return this.templatesRead().filter((template) => template.category === category);
  }

  /**
   * Returns the payload that places a copy of a prefab, with its internal names
   * and entity I/O targets scoped by an auto-incrementing suffix.
   *
   * @param id Template id.
   * @param scoped Whether to scope internal names (`true` by default).
   * @returns Payload at the captured position, or null when the id is unknown.
   */
  placementPayloadRead(id: string, scoped: boolean = true): ClipboardPayload | null {
    const template = this.templateFind(id);
    if (!template) {
      return null;
    }
    return prefabPayloadScope(template.payload, scoped ? `inst${this.nextStampCounter++}` : '');
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

  /**
   * Derives an unused id from a prefab name: lower case letters, digits and
   * underscores, with a number appended while the id is taken.
   *
   * @param name Prefab name.
   * @returns Unused id.
   */
  private idAllocate(name: string): string {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'prefab';
    let candidate = base;
    for (let counter = 2; this.templates.has(candidate); counter += 1) {
      candidate = `${base}_${counter}`;
    }
    return candidate;
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
