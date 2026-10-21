import { describe, expect, it } from 'vitest';
import { LayerList } from '@/layer/model/layer_list.js';
import { LAYER_DEFAULT_ID, LAYER_DEFAULT_NAME, layerDefinitionCreate } from '@/layer/model/layer_definition.js';

/**
 * Unit tests for the ordered layer list: the default layer is always first and
 * keeps its name, new layers get unused names and identifiers, and moves never
 * pass the default layer.
 */
describe('LayerList', () => {
  it('starts with only the default layer', () => {
    const list = new LayerList();
    expect(list.listRead().map((definition) => definition.id)).toEqual([LAYER_DEFAULT_ID]);
    expect(list.defaultRead().name).toBe(LAYER_DEFAULT_NAME);
  });

  it('allocates "Layer N" names and identifiers that are not in use', () => {
    const list = new LayerList();
    const first = list.definitionAllocate();
    list.insert(first, 1);
    const second = list.definitionAllocate();
    expect(second.name).not.toBe(first.name);
    expect(second.id).not.toBe(first.id);
    expect(first.name).toMatch(/^Layer \d+$/);
  });

  it('refuses to remove or rename the default layer', () => {
    const list = new LayerList();
    expect(list.delete(LAYER_DEFAULT_ID)).toBe(-1);
    expect(list.rename(LAYER_DEFAULT_ID, 'Other')).toBe(false);
    expect(list.defaultRead().name).toBe(LAYER_DEFAULT_NAME);
  });

  it('keeps the default layer first when inserting or moving to the front', () => {
    const list = new LayerList();
    const added = list.definitionAllocate();
    list.insert(added, 0);
    expect(list.indexOf(added.id)).toBe(1);
    expect(list.move(added.id, 0)).toBe(false);
    expect(list.indexOf(LAYER_DEFAULT_ID)).toBe(0);
  });

  it('refuses blank names and duplicate identifiers', () => {
    const list = new LayerList();
    const added = list.definitionAllocate();
    list.insert(added, 1);
    expect(list.rename(added.id, '   ')).toBe(false);
    expect(list.insert(added, 1)).toBe(false);
    expect(list.listRead().length).toBe(2);
  });

  it('replaces the layers, keeping a default first with its fixed name', () => {
    const list = new LayerList();
    const other = layerDefinitionCreate('other_layer', 'Other');
    const renamedDefault = { ...layerDefinitionCreate(LAYER_DEFAULT_ID, 'Renamed'), hidden: true };
    list.replace([other, renamedDefault]);
    expect(list.listRead().map((definition) => definition.id)).toEqual([LAYER_DEFAULT_ID, 'other_layer']);
    expect(list.defaultRead().name).toBe(LAYER_DEFAULT_NAME);
    expect(list.defaultRead().hidden).toBe(true);
  });
});
