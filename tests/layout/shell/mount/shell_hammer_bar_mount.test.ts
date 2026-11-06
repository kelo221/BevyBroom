import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import type { ShellInspector, ShellInspectorSlot } from '@/layout/shell/inspector/shell_inspector.js';
import { shellTestDocksCreate, shellTestDocksDispose, type ShellTestDocks } from '../shell_test_support.js';
import { ShellHammerBarMount } from '@/layout/shell/mount/shell_hammer_bar_mount.js';
import { visGroupSharedServicesCreate } from '@/visgroup/visgroup_shared_services.js';
import { PrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import { CommandStack } from '@/commands/command_stack.js';
import { setStateTexturePaintForTests, StateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import { Theme } from '@/theme.js';
import { SHELL_DOCK_COMPACT_CONTROL_CLASS } from '@/layout/shell/dock/shell_dock_compact.js';

/** Hammer bar slots the mount fills, top to bottom. */
const SHELL_HAMMER_BAR_MOUNT_TEST_SLOTS: readonly ShellInspectorSlot[] = [
  'hammer_object_bar',
  'hammer_visgroups',
  'hammer_prefabs',
];

/** Inspector, mount and spy refresh hook a Hammer bar test works with. */
interface ShellHammerBarMountTestRig {
  readonly docks: ShellTestDocks;
  readonly inspector: ShellInspector;
  readonly mount: ShellHammerBarMount;
  readonly afterWorldMutation: ReturnType<typeof vi.fn>;
  readonly textureBrowse: ReturnType<typeof vi.fn>;
  readonly commandStack: CommandStack;
}

/** Rig built by the running test. */
let shellHammerBarMountTestRig: ShellHammerBarMountTestRig | null = null;

/**
 * Builds an inspector in the document with the Hammer bar sections mounted over
 * fresh services.
 *
 * @returns Test rig remembered for cleanup.
 */
function shellHammerBarMountTestRigCreate(): ShellHammerBarMountTestRig {
  const docks = shellTestDocksCreate();
  const inspector = docks.inspector;
  const afterWorldMutation = vi.fn();
  const textureBrowse = vi.fn();
  const commandStack = new CommandStack(16);
  const mount = new ShellHammerBarMount({
    inspector,
    objectBarHandlers: { textureBrowse, textureReplace: vi.fn(), textureDescribe: () => null },
    worldObject: new THREE.Group(),
    selectionManager: new ManagerSelection(),
    visGroupServices: visGroupSharedServicesCreate(),
    prefabCatalogStore: new PrefabCatalogStore(),
    commandStack,
    afterWorldMutation,
  });
  shellHammerBarMountTestRig = { docks, inspector, mount, afterWorldMutation, textureBrowse, commandStack };
  return shellHammerBarMountTestRig;
}

/**
 * Reads the text of one inspector slot.
 *
 * @param inspector Inspector holding the slot.
 * @param slot Inspector slot.
 * @returns Text content of the slot.
 */
function slotTextRead(inspector: ShellInspector, slot: ShellInspectorSlot): string {
  return inspector.slotRead(slot).textContent ?? '';
}

/**
 * Returns the widest fixed pixel width an element asks for through its inline
 * width, minimum width, flex basis or grid columns.
 *
 * @param element Element to inspect.
 * @returns Widest fixed width in CSS pixels, or zero when none is fixed.
 */
function shellHammerBarMountTestFixedWidthPxRead(element: HTMLElement): number {
  const style = element.style;
  const singleWidths = [style.width, style.minWidth, style.flexBasis, style.flex].map((value) =>
    Math.max(0, ...[...value.matchAll(/(\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]))),
  );
  const gridColumnsPx = [...style.gridTemplateColumns.matchAll(/(\d+(?:\.\d+)?)px/g)].reduce(
    (sum, match) => sum + Number(match[1]),
    0,
  );
  return Math.max(gridColumnsPx, ...singleWidths);
}

beforeEach(() => {
  setStateTexturePaintForTests(new StateTexturePaint());
});

afterEach(() => {
  if (shellHammerBarMountTestRig) {
    shellHammerBarMountTestRig.mount.dispose();
    shellTestDocksDispose(shellHammerBarMountTestRig.docks);
    shellHammerBarMountTestRig = null;
  }
  setStateTexturePaintForTests(null);
  document.body.replaceChildren();
});

describe('ShellHammerBarMount', () => {
  it('fills the Object Bar, VisGroups and prefab slots', () => {
    const { inspector, mount } = shellHammerBarMountTestRigCreate();
    SHELL_HAMMER_BAR_MOUNT_TEST_SLOTS.forEach((slot) => {
      expect(inspector.slotRead(slot).childElementCount).toBeGreaterThan(0);
    });
    expect(inspector.slotRead('hammer_object_bar').contains(mount.objectBar.getElement())).toBe(true);
    expect(inspector.slotRead('hammer_visgroups').contains(mount.visGroupsPanel.getElement())).toBe(true);
    expect(inspector.slotRead('hammer_prefabs').contains(mount.prefabPanel.elementRead())).toBe(true);
  });

  it('shows the Hammer++ section captions', () => {
    const { inspector } = shellHammerBarMountTestRigCreate();
    expect(slotTextRead(inspector, 'hammer_object_bar')).toContain('Select:');
    expect(slotTextRead(inspector, 'hammer_object_bar')).toContain('Current texture:');
    expect(slotTextRead(inspector, 'hammer_visgroups')).toContain('VisGroups:');
    ['Move selected:', 'Categories:', 'Objects:'].forEach((caption) => {
      expect(slotTextRead(inspector, 'hammer_prefabs')).toContain(caption);
    });
  });

  it('puts Move selected first in the prefab section', () => {
    const { mount } = shellHammerBarMountTestRigCreate();
    const firstRow = mount.prefabPanel.elementRead().firstElementChild;
    expect(firstRow?.textContent ?? '').toContain('Move selected:');
  });

  it('runs the Object Bar Browse action', () => {
    const { inspector, textureBrowse } = shellHammerBarMountTestRigCreate();
    inspector.slotRead('hammer_object_bar').querySelector<HTMLElement>('.shell-inspector-texture-browse')?.click();
    expect(textureBrowse).toHaveBeenCalledOnce();
  });

  it('refreshes the editor after the VisGroups panel changed visibility', () => {
    const { inspector, afterWorldMutation } = shellHammerBarMountTestRigCreate();
    const cordonToggle = inspector.slotRead('hammer_visgroups').querySelector<HTMLElement>('.visgroup-cordon-toggle');
    expect(cordonToggle).not.toBeNull();
    cordonToggle?.click();
    expect(afterWorldMutation).toHaveBeenCalledOnce();
  });

  it('records the VisGroups Edit action on the undo stack and refreshes the editor', () => {
    const { inspector, afterWorldMutation, commandStack } = shellHammerBarMountTestRigCreate();
    const footerButtons = inspector
      .slotRead('hammer_visgroups')
      .querySelectorAll<HTMLButtonElement>('.panel-visgroups-footer button');
    [...footerButtons].find((button) => button.textContent === 'Edit')?.click();
    expect(commandStack.getUndoCount()).toBe(1);
    expect(afterWorldMutation).toHaveBeenCalledOnce();
  });

  it('fits every Hammer bar section into a dock of the default right dock width', () => {
    const { inspector } = shellHammerBarMountTestRigCreate();
    inspector.getElement().style.width = `${Theme.rightDockWidthPx}px`;
    SHELL_HAMMER_BAR_MOUNT_TEST_SLOTS.forEach((slot) => {
      const elements = [...inspector.slotRead(slot).querySelectorAll<HTMLElement>('*')];
      elements.forEach((element) => {
        expect(shellHammerBarMountTestFixedWidthPxRead(element)).toBeLessThanOrEqual(Theme.rightDockWidthPx);
      });
    });
  });

  it('gives every Hammer bar button and field the compact dock height and lets labels ellipsize', () => {
    const { inspector } = shellHammerBarMountTestRigCreate();
    const controls = SHELL_HAMMER_BAR_MOUNT_TEST_SLOTS.flatMap((slot) => [
      ...inspector.slotRead(slot).querySelectorAll<HTMLElement>('button:not([role="tab"]), select, input[type="text"]'),
    ]);
    expect(controls.length).toBeGreaterThan(0);
    controls.forEach((control) => {
      expect(control.classList.contains(SHELL_DOCK_COMPACT_CONTROL_CLASS)).toBe(true);
      expect(control.style.height).toBe(`${Theme.dockControlHeightPx}px`);
      expect(control.style.minWidth).toMatch(/^0(px)?$/);
    });
    controls
      .filter((control) => control instanceof HTMLButtonElement)
      .forEach((button) => {
        expect(button.style.textOverflow).toBe('ellipsis');
        expect(button.title.length).toBeGreaterThan(0);
      });
  });

  it('empties every Hammer bar slot on dispose', () => {
    const { inspector, mount } = shellHammerBarMountTestRigCreate();
    mount.dispose();
    SHELL_HAMMER_BAR_MOUNT_TEST_SLOTS.forEach((slot) => {
      expect(inspector.slotRead(slot).childElementCount).toBe(0);
    });
  });
});
