import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { PrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import { CommandPrefabTemplateAdd } from '@/prefab/commands/command_prefab_template_add.js';

/** Unit tests for the undoable prefab template addition. */
describe('CommandPrefabTemplateAdd', () => {
  it('adds the template, removes it on undo and adds the same template on redo', () => {
    const store = new PrefabCatalogStore();
    const template = store.templateCapture('Lamp', 'Lights', [new THREE.Mesh()]);
    const stack = new CommandStack(8);
    stack.push(new CommandPrefabTemplateAdd(store, template));
    expect(store.templateFind(template.id)).toBe(template);
    expect(store.categoriesRead()).toContain(template.category);
    stack.undo();
    expect(store.templateFind(template.id)).toBeNull();
    stack.redo();
    expect(store.templateFind(template.id)).toBe(template);
  });
});
