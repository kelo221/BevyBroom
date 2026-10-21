import { afterEach, describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { LAYER_DEFAULT_ID } from '@/layer/model/layer_definition.js';
import { layerIdStoredRead } from '@/layer/model/layer_membership.js';
import { PanelLayers } from '@/layer/ui/panel_layers.js';
import { panelLayersObjectCountFormat } from '@/layer/ui/panel_layers_row.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import {
  type LayerTestWorld,
  layerTestBoxAddToLayer,
  layerTestLayerAdd,
  layerTestWorldCreate,
} from '../layer_test_world.js';

/** Panel, its host, world and editor systems for one test. */
interface PanelLayersRig {
  host: HTMLElement;
  panel: PanelLayers;
  testWorld: LayerTestWorld;
  stack: CommandStack;
  selection: ManagerSelection;
}

/** Panels created by the current test, disposed after it. */
const openPanels: PanelLayers[] = [];

/**
 * Mounts a layers panel over a fresh world in a host attached to the document.
 *
 * @returns Test rig.
 */
function panelLayersRigCreate(): PanelLayersRig {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const testWorld = layerTestWorldCreate();
  const stack = new CommandStack(32);
  const selection = new ManagerSelection();
  const panel = new PanelLayers(host, {
    layerManager: testWorld.manager,
    commandStack: stack,
    selectionManager: selection,
    worldGroup: testWorld.world,
    refresh: () => undefined,
  });
  openPanels.push(panel);
  return { host, panel, testWorld, stack, selection };
}

/**
 * Finds the row element of a layer.
 *
 * @param rig Test rig.
 * @param layerIdentifier Layer identifier.
 * @returns Row element.
 */
function rowFind(rig: PanelLayersRig, layerIdentifier: string): HTMLElement {
  const row = rig.panel.getElement().querySelector<HTMLElement>(`[data-layer-id="${layerIdentifier}"]`);
  if (row === null) {
    throw new Error(`No row for layer ${layerIdentifier}`);
  }
  return row;
}

/**
 * Finds an element inside a row.
 *
 * @param row Row element.
 * @param selector CSS selector.
 * @returns The element.
 */
function rowPartFind<Element extends HTMLElement>(row: HTMLElement, selector: string): Element {
  const part = row.querySelector<Element>(selector);
  if (part === null) {
    throw new Error(`No ${selector} in the row`);
  }
  return part;
}

/**
 * Clicks a bottom bar button.
 *
 * @param rig Test rig.
 * @param action Button action name.
 */
function toolbarClick(rig: PanelLayersRig, action: string): void {
  rowPartFind<HTMLButtonElement>(rig.panel.getElement(), `[data-layer-action="${action}"]`).click();
}

/**
 * Unit tests for the layers panel: rows reflect the layers, the bottom bar and
 * row controls edit them through undoable commands, and the context menu acts
 * on the selection.
 */
describe('PanelLayers', () => {
  afterEach(() => {
    openPanels.splice(0).forEach((panel) => panel.dispose());
    document.body.replaceChildren();
  });

  it('fills its host and shows the default layer as current with its object count', () => {
    const rig = panelLayersRigCreate();
    layerTestBoxAddToLayer(rig.testWorld, LAYER_DEFAULT_ID, 'box');
    rig.panel.render();
    const row = rowFind(rig, LAYER_DEFAULT_ID);
    expect(rig.panel.getElement().parentElement).toBe(rig.host);
    expect(rig.panel.getElement().style.height).toBe('100%');
    expect(rowPartFind<HTMLInputElement>(row, 'input[type="radio"]').checked).toBe(true);
    expect(rowPartFind(row, '[data-layer-object-count]').textContent).toBe(panelLayersObjectCountFormat(1));
    expect(panelLayersObjectCountFormat(2)).toBe('2 objects');
  });

  it('adds a layer with the + button and renames it inline', () => {
    const rig = panelLayersRigCreate();
    toolbarClick(rig, 'add');
    const addedIdentifier = rig.panel.selectedLayerIdRead();
    const input = rig.panel.renameInputRead();
    expect(input).not.toBeNull();
    if (input === null) return;
    input.value = 'Lights';
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
    expect(rig.testWorld.manager.layerFind(addedIdentifier)?.name).toBe('Lights');
    expect(rowPartFind(rowFind(rig, addedIdentifier), '[data-layer-name]').textContent).toBe('Lights');
    rig.stack.undo();
    expect(rig.testWorld.manager.layerFind(addedIdentifier)?.name).not.toBe('Lights');
  });

  it('disables removing and moving the default layer', () => {
    const rig = panelLayersRigCreate();
    const panelElement = rig.panel.getElement();
    expect(rowPartFind<HTMLButtonElement>(panelElement, '[data-layer-action="remove"]').disabled).toBe(true);
    expect(rowPartFind<HTMLButtonElement>(panelElement, '[data-layer-action="moveDown"]').disabled).toBe(true);
  });

  it('toggles layer switches from the row icons as undoable edits', () => {
    const rig = panelLayersRigCreate();
    const layer = layerTestLayerAdd(rig.testWorld.manager, 'Switches');
    rig.panel.render();
    rowPartFind<HTMLButtonElement>(rowFind(rig, layer.id), '[data-layer-flag="hidden"]').click();
    expect(rig.testWorld.manager.layerFind(layer.id)?.hidden).toBe(true);
    rig.panel.render();
    const toggle = rowPartFind<HTMLButtonElement>(rowFind(rig, layer.id), '[data-layer-flag="hidden"]');
    expect(toggle.dataset['layerFlagOn']).toBe('true');
    rig.stack.undo();
    expect(rig.testWorld.manager.layerFind(layer.id)?.hidden).toBe(false);
  });

  it('makes a layer current on double-click and shows its name in bold', () => {
    const rig = panelLayersRigCreate();
    const layer = layerTestLayerAdd(rig.testWorld.manager, 'Current');
    rig.panel.render();
    rowFind(rig, layer.id).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(rig.testWorld.manager.currentLayerIdRead()).toBe(layer.id);
    rig.panel.render();
    expect(rowPartFind(rowFind(rig, layer.id), '[data-layer-name]').style.fontWeight).toBe('700');
  });

  it('removes the selected layer with the − button and moves layers with the arrows', () => {
    const rig = panelLayersRigCreate();
    const first = layerTestLayerAdd(rig.testWorld.manager, 'First');
    const second = layerTestLayerAdd(rig.testWorld.manager, 'Second');
    rig.panel.render();
    rowFind(rig, second.id).click();
    toolbarClick(rig, 'moveUp');
    expect(rig.testWorld.manager.layerIndexOf(second.id)).toBeLessThan(rig.testWorld.manager.layerIndexOf(first.id));
    toolbarClick(rig, 'remove');
    expect(rig.testWorld.manager.layerFind(second.id)).toBeNull();
  });

  it('moves the selection into a layer from the context menu', () => {
    const rig = panelLayersRigCreate();
    const layer = layerTestLayerAdd(rig.testWorld.manager, 'Target');
    const box = layerTestBoxAddToLayer(rig.testWorld, LAYER_DEFAULT_ID, 'box');
    rig.selection.setSelection([box]);
    rig.panel.render();
    rowFind(rig, layer.id).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 4, clientY: 4 }));
    const items = [...document.querySelectorAll<HTMLElement>('button')];
    const moveItem = items.find((item) => item.textContent?.includes('Move Selection Here'));
    expect(moveItem).toBeDefined();
    moveItem?.click();
    expect(layerIdStoredRead(box)).toBe(layer.id);
  });
});
