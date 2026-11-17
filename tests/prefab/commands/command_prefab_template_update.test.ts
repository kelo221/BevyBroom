import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandPrefabTemplateUpdate } from '@/prefab/commands/command_prefab_template_update.js';
import { PrefabCatalogStore, type PrefabCatalogPersistence } from '@/prefab/prefab_catalog_store.js';
import type { PrefabTemplate } from '@/prefab/prefab_types.js';

/** Persistence recording the name and category of every saved template. */
class PrefabUpdatePersistenceRecorder implements PrefabCatalogPersistence {
  readonly saved: string[] = [];

  /** @inheritdoc */
  templateSave(template: PrefabTemplate): void {
    this.saved.push(`${template.id}:${template.name}:${template.category}`);
  }

  /** @inheritdoc */
  templateDelete(): void {}
}

/** Unit tests for the undoable prefab rename and recategorization. */
describe('CommandPrefabTemplateUpdate', () => {
  it('stores the changed template under the same id, saves it, and restores the previous one on undo', () => {
    const store = new PrefabCatalogStore();
    const persistence = new PrefabUpdatePersistenceRecorder();
    const world = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    world.add(mesh);
    const before = store.templateCapture('Lamp', 'Lights', [mesh]);
    if (before === null) throw new Error('the lamp can be captured');
    store.persistenceAttach(persistence, [before]);
    const after = { ...before, name: 'Desk Lamp', category: 'Furniture' };
    const stack = new CommandStack(8);
    stack.push(new CommandPrefabTemplateUpdate(store, before, after));
    expect(store.templateFind(before.id)).toBe(after);
    expect(store.templatesRead()).toHaveLength(1);
    stack.undo();
    expect(store.templateFind(before.id)).toBe(before);
    expect(persistence.saved).toEqual([`${before.id}:Desk Lamp:Furniture`, `${before.id}:Lamp:Lights`]);
  });
});
