import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { StateCordon } from '@/cordon/state_cordon.js';
import { CordonFilterApplier } from '@/cordon/cordon_filter_applier.js';
import { VisGroupStore } from '@/visgroup/visgroup_store.js';
import {
  PANEL_VISGROUPS_EMPTY_HINT_CLASS,
  PANEL_VISGROUPS_LIST_CLASS,
  PANEL_VISGROUPS_LIST_MIN_HEIGHT_PX,
  PANEL_VISGROUPS_ROW_SELECTED_CLASS,
  PanelVisGroups,
} from '@/visgroup/ui/panel_visgroups.js';

/** Panel, store, history and selected mesh a VisGroups panel test works with. */
interface VisGroupsPanelTestRig {
  readonly panel: PanelVisGroups;
  readonly store: VisGroupStore;
  readonly stack: CommandStack;
  readonly afterCommand: ReturnType<typeof vi.fn>;
  readonly mesh: THREE.Mesh;
}

/** Panels built by the running test. */
const visGroupsPanelTestPanels: PanelVisGroups[] = [];

/**
 * Builds a VisGroups panel over a world with one selected mesh whose commands
 * go through a real undo stack.
 *
 * @returns Test rig.
 */
function visGroupsPanelTestRigCreate(): VisGroupsPanelTestRig {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const world = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  world.add(mesh);
  const store = new VisGroupStore();
  const cordonState = new StateCordon();
  const stack = new CommandStack(16);
  const afterCommand = vi.fn();
  const panel = new PanelVisGroups(host, {
    store,
    cordonState,
    cordonApplier: new CordonFilterApplier(cordonState),
    worldRoot: world,
    selectionTarget: { setSelection: vi.fn(() => true), getInspectorObjects: () => [mesh] },
    commandRun: (command) => {
      stack.push(command);
      afterCommand();
    },
    afterVisibilityChange: () => undefined,
  });
  visGroupsPanelTestPanels.push(panel);
  return { panel, store, stack, afterCommand, mesh };
}

/**
 * Finds a footer button by its label.
 *
 * @param panel VisGroups panel.
 * @param label Button label.
 * @returns Footer button.
 */
function visGroupsPanelTestFooterButton(panel: PanelVisGroups, label: string): HTMLButtonElement {
  const buttons = [...panel.getElement().querySelectorAll<HTMLButtonElement>('.panel-visgroups-footer button')];
  const button = buttons.find((candidate) => candidate.textContent === label);
  if (!button) throw new Error(`missing footer button ${label}`);
  return button;
}

/**
 * Finds the row of a VisGroup.
 *
 * @param panel VisGroups panel.
 * @param groupId VisGroup id.
 * @returns Row element, or null when not rendered.
 */
function visGroupsPanelTestRowFind(panel: PanelVisGroups, groupId: string): HTMLElement | null {
  return panel.getElement().querySelector<HTMLElement>(`.visgroup-row[data-visgroup-id="${groupId}"]`);
}

/**
 * Lists the ids of every highlighted row.
 *
 * @param panel VisGroups panel.
 * @returns Highlighted VisGroup ids.
 */
function visGroupsPanelTestSelectedRowIds(panel: PanelVisGroups): string[] {
  const rows = panel.getElement().querySelectorAll<HTMLElement>(`.${PANEL_VISGROUPS_ROW_SELECTED_CLASS}`);
  return [...rows].map((row) => row.dataset['visgroupId'] ?? '');
}

afterEach(() => {
  visGroupsPanelTestPanels.splice(0).forEach((panel) => panel.dispose());
  document.body.replaceChildren();
});

/**
 * Unit tests for the VisGroups panel selection display and undoable Edit
 * action.
 */
describe('PanelVisGroups', () => {
  it('creates a group holding the selection as one undoable step that undo and redo replay', () => {
    const { panel, store, stack, afterCommand, mesh } = visGroupsPanelTestRigCreate();
    visGroupsPanelTestFooterButton(panel, 'Edit').click();
    const [created] = store.userGroupsList();
    if (!created) throw new Error('Edit created no group');
    expect(store.objectGroupIdsRead(mesh)).toEqual([created.id]);
    expect(stack.getUndoCount()).toBe(1);
    expect(afterCommand).toHaveBeenCalledOnce();
    stack.undo();
    expect(store.userGroupsList()).toEqual([]);
    expect(store.objectGroupIdsRead(mesh)).toEqual([]);
    stack.redo();
    expect(store.userGroupsList().map((group) => group.id)).toEqual([created.id]);
    expect(store.objectGroupIdsRead(mesh)).toEqual([created.id]);
  });

  it('highlights exactly the clicked row in the selection color', () => {
    const { panel } = visGroupsPanelTestRigCreate();
    const lightsRow = visGroupsPanelTestRowFind(panel, 'lights');
    if (!lightsRow) throw new Error('missing Auto lights row');
    lightsRow.click();
    expect(panel.selectedGroupIdRead()).toBe('lights');
    expect(visGroupsPanelTestSelectedRowIds(panel)).toEqual(['lights']);
    expect(lightsRow.style.background).not.toBe('transparent');
    visGroupsPanelTestRowFind(panel, 'meshes')?.click();
    expect(visGroupsPanelTestSelectedRowIds(panel)).toEqual(['meshes']);
    expect(lightsRow.style.background).toBe('transparent');
  });

  it('shows bordered list boxes with a minimum height and an empty hint until a group exists', () => {
    const { panel, stack } = visGroupsPanelTestRigCreate();
    const lists = [...panel.getElement().querySelectorAll<HTMLElement>(`.${PANEL_VISGROUPS_LIST_CLASS}`)];
    expect(lists.length).toBeGreaterThanOrEqual(2);
    lists.forEach((list) => {
      expect(list.style.minHeight).toBe(`${PANEL_VISGROUPS_LIST_MIN_HEIGHT_PX}px`);
      expect(list.style.borderStyle || list.style.border).toContain('solid');
    });
    const hintCount = (): number => panel.getElement().querySelectorAll(`.${PANEL_VISGROUPS_EMPTY_HINT_CLASS}`).length;
    expect(hintCount()).toBe(1);
    visGroupsPanelTestFooterButton(panel, 'Edit').click();
    expect(hintCount()).toBe(0);
    stack.undo();
    expect(hintCount()).toBe(1);
  });

  it('highlights a newly created group and disables Show and Mark once it is undone', () => {
    const { panel, stack } = visGroupsPanelTestRigCreate();
    visGroupsPanelTestFooterButton(panel, 'Edit').click();
    const createdId = panel.selectedGroupIdRead() ?? '';
    expect(visGroupsPanelTestSelectedRowIds(panel)).toEqual([createdId]);
    expect(visGroupsPanelTestFooterButton(panel, 'Show').disabled).toBe(false);
    stack.undo();
    expect(panel.selectedGroupIdRead()).toBeNull();
    expect(visGroupsPanelTestSelectedRowIds(panel)).toEqual([]);
    expect(visGroupsPanelTestFooterButton(panel, 'Show').disabled).toBe(true);
    expect(visGroupsPanelTestFooterButton(panel, 'Mark').disabled).toBe(true);
    expect(visGroupsPanelTestFooterButton(panel, 'Edit').disabled).toBe(false);
  });
});
