import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { PrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import { PanelPrefabDock } from '@/prefab/ui/panel_prefab_dock.js';
import { PREFAB_ENTITY_TIE_DEFAULT_CLASS } from '@/prefab/commands/command_prefab_entity_tie.js';
import {
  INPUT_WHEEL_TEST_NOTCH_DOWN,
  INPUT_WHEEL_TEST_NOTCH_UP,
  inputWheelTestDispatch,
} from '../../ui/input/wheel/input_wheel_test_support.js';

/** Dock, world, history and selection a prefab dock test works with. */
interface PrefabDockTestRig {
  readonly dock: PanelPrefabDock;
  readonly host: HTMLElement;
  readonly world: THREE.Group;
  readonly store: PrefabCatalogStore;
  readonly stack: CommandStack;
  readonly afterCommand: ReturnType<typeof vi.fn>;
  readonly selection: THREE.Object3D[];
}

/** Docks built by the running test. */
const prefabDockTestDocks: PanelPrefabDock[] = [];

/**
 * Builds a prefab dock over a world with two selected meshes whose commands go
 * through a real undo stack.
 *
 * @returns Test rig.
 */
function prefabDockTestRigCreate(): PrefabDockTestRig {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const world = new THREE.Group();
  const selection: THREE.Object3D[] = [new THREE.Mesh(), new THREE.Mesh()];
  selection.forEach((object) => world.add(object));
  const store = new PrefabCatalogStore();
  const stack = new CommandStack(16);
  const afterCommand = vi.fn();
  const dock = new PanelPrefabDock(
    host,
    {
      selectedObjectsRead: () => [...selection],
      worldRootRead: () => world,
      commandRun: (command) => {
        stack.push(command);
        afterCommand();
      },
    },
    store,
  );
  prefabDockTestDocks.push(dock);
  return { dock, host, world, store, stack, afterCommand, selection };
}

/**
 * Clicks a dock button by its action class.
 *
 * @param host Dock host.
 * @param className Action class of the button.
 */
function prefabDockTestButtonClick(host: HTMLElement, className: string): void {
  const button = host.querySelector<HTMLButtonElement>(`.${className}`);
  if (!button) throw new Error(`missing button ${className}`);
  button.click();
}

afterEach(() => {
  prefabDockTestDocks.splice(0).forEach((dock) => dock.dispose());
  document.body.replaceChildren();
});

/** Unit tests for the undoable actions of the prefab dock. */
describe('PanelPrefabDock', () => {
  it('shows the four compact action buttons', () => {
    const { host } = prefabDockTestRigCreate();
    ['panel-prefab-insert', 'panel-prefab-create', 'panel-prefab-to-world', 'panel-prefab-to-entity'].forEach(
      (className) => expect(host.querySelector(`button.${className}`)).not.toBeNull(),
    );
  });

  it('keeps every action button label on one line, ellipsized with a tooltip, and lets the name field shrink', () => {
    const { host } = prefabDockTestRigCreate();
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('.panel-prefab-dock button')];
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((button) => {
      expect(getComputedStyle(button).whiteSpace).toBe('nowrap');
      expect(button.style.textOverflow).toBe('ellipsis');
      expect(button.style.minWidth).toMatch(/^0(px)?$/);
      expect(button.title.length).toBeGreaterThan(0);
    });
    const nameInput = host.querySelector<HTMLInputElement>('.panel-prefab-name-input');
    expect(nameInput?.style.minWidth).toMatch(/^0(px)?$/);
  });

  it('creates a prefab as one undoable step that undo removes and redo restores', () => {
    const { host, store, stack, afterCommand } = prefabDockTestRigCreate();
    prefabDockTestButtonClick(host, 'panel-prefab-create');
    const objectSelect = host.querySelector<HTMLSelectElement>('.panel-prefab-object-select');
    const createdId = objectSelect?.value ?? '';
    expect(store.templateFind(createdId)).not.toBeNull();
    expect(stack.getUndoCount()).toBe(1);
    expect(afterCommand).toHaveBeenCalledOnce();
    stack.undo();
    expect(store.templateFind(createdId)).toBeNull();
    stack.redo();
    expect(store.templateFind(createdId)).not.toBeNull();
  });

  it('inserts the chosen prefab as one undoable step', () => {
    const { host, world, stack } = prefabDockTestRigCreate();
    prefabDockTestButtonClick(host, 'panel-prefab-create');
    const childCountBefore = world.children.length;
    prefabDockTestButtonClick(host, 'panel-prefab-insert');
    expect(world.children.length).toBe(childCountBefore + 1);
    const stamped = world.children[world.children.length - 1];
    stack.undo();
    expect(world.children.length).toBe(childCountBefore);
    stack.redo();
    expect(world.children[world.children.length - 1]).toBe(stamped);
  });

  it('steps the Objects list with the wheel so Insert stamps the newly chosen prefab', () => {
    const { host, store } = prefabDockTestRigCreate();
    prefabDockTestButtonClick(host, 'panel-prefab-create');
    const objectSelect = host.querySelector<HTMLSelectElement>('.panel-prefab-object-select');
    if (!objectSelect) throw new Error('objects list missing');
    const firstId = objectSelect.value;
    prefabDockTestButtonClick(host, 'panel-prefab-create');
    const secondId = objectSelect.value;
    expect(secondId).not.toBe(firstId);
    const optionIds = Array.from(objectSelect.options).map((option) => option.value);
    const wheelTowardFirst =
      optionIds.indexOf(firstId) < optionIds.indexOf(secondId)
        ? INPUT_WHEEL_TEST_NOTCH_UP
        : INPUT_WHEEL_TEST_NOTCH_DOWN;
    inputWheelTestDispatch(objectSelect, wheelTowardFirst);
    expect(objectSelect.value).toBe(firstId);
    const stampSpy = vi.spyOn(store, 'stampTemplate');
    prefabDockTestButtonClick(host, 'panel-prefab-insert');
    expect(stampSpy.mock.calls[0]?.[0]).toBe(firstId);
  });

  it('ties the selection to an entity and moves it back to world, each undoable', () => {
    const { host, world, stack, selection } = prefabDockTestRigCreate();
    prefabDockTestButtonClick(host, 'panel-prefab-to-entity');
    const group = selection[0]?.parent;
    if (!group || group === world) throw new Error('selection was not grouped');
    expect(GameEntityComponentStore.read(group)[PREFAB_ENTITY_TIE_DEFAULT_CLASS]).toBeDefined();
    selection.splice(0, selection.length, group);
    prefabDockTestButtonClick(host, 'panel-prefab-to-world');
    expect(GameEntityComponentStore.hasAny(group)).toBe(false);
    stack.undo();
    expect(GameEntityComponentStore.hasAny(group)).toBe(true);
    stack.undo();
    expect(group.parent).toBeNull();
    stack.redo();
    expect(group.parent).toBe(world);
  });
});
