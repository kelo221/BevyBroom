import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { PrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import { CommandPrefabTemplateAdd } from '@/prefab/commands/command_prefab_template_add.js';
import { CommandPrefabTemplateRemove } from '@/prefab/commands/command_prefab_template_remove.js';

/**
 * Captures a lamp mesh as a template, failing the test when nothing was
 * captured.
 *
 * @param store Catalog store.
 * @returns Template.
 */
function lampTemplateCapture(store: PrefabCatalogStore) {
  const world = new THREE.Group();
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  world.add(lamp);
  const template = store.templateCapture('Lamp', 'Lights', [lamp]);
  if (template === null) throw new Error('the lamp can be captured');
  return template;
}

/** Unit tests for the undoable prefab template addition and removal. */
describe('CommandPrefabTemplateAdd and CommandPrefabTemplateRemove', () => {
  it('adds the template, removes it on undo and adds the same template on redo', () => {
    const store = new PrefabCatalogStore();
    const template = lampTemplateCapture(store);
    const stack = new CommandStack(8);
    stack.push(new CommandPrefabTemplateAdd(store, template));
    expect(store.templateFind(template.id)).toBe(template);
    expect(store.categoriesRead()).toContain(template.category);
    stack.undo();
    expect(store.templateFind(template.id)).toBeNull();
    stack.redo();
    expect(store.templateFind(template.id)).toBe(template);
  });

  it('removes the template and brings the same one back on undo', () => {
    const store = new PrefabCatalogStore();
    const template = lampTemplateCapture(store);
    store.templateAdd(template);
    const stack = new CommandStack(8);
    stack.push(new CommandPrefabTemplateRemove(store, template));
    expect(store.templateFind(template.id)).toBeNull();
    stack.undo();
    expect(store.templateFind(template.id)).toBe(template);
  });
});
