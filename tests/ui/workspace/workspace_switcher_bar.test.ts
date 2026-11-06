import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  WORKSPACE_SWITCHER_CLASS,
  WORKSPACE_SWITCHER_NAME_CLASS,
  WorkspaceSwitcherBar,
} from '@/ui/workspace/workspace_switcher_bar.js';
import {
  createDefaultWorkspaces,
  WORKSPACE_IDS,
  type WorkspaceDefinition,
} from '@/layout/workspace/workspace_definition.js';

/** Layout chooser, its action spies and the layouts it shows. */
interface WorkspaceSwitcherBarTestRig {
  readonly bar: WorkspaceSwitcherBar;
  readonly parent: HTMLElement;
  readonly actions: {
    onSelectWorkspace: ReturnType<typeof vi.fn>;
    onAddPresetWorkspace: ReturnType<typeof vi.fn>;
    onDuplicateCurrent: ReturnType<typeof vi.fn>;
    onDeleteWorkspace: ReturnType<typeof vi.fn>;
    onRenameWorkspace: ReturnType<typeof vi.fn>;
    onReorderWorkspace: ReturnType<typeof vi.fn>;
  };
  readonly workspaces: WorkspaceDefinition[];
}

/** Chooser built by the running test. */
let workspaceSwitcherBarTestBar: WorkspaceSwitcherBar | null = null;

/**
 * Builds a chooser showing the default layouts with the Quad View active.
 *
 * @returns Test rig.
 */
function workspaceSwitcherBarTestRigCreate(): WorkspaceSwitcherBarTestRig {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const actions = {
    onSelectWorkspace: vi.fn(),
    onAddPresetWorkspace: vi.fn(),
    onDuplicateCurrent: vi.fn(),
    onDeleteWorkspace: vi.fn(),
    onRenameWorkspace: vi.fn(),
    onReorderWorkspace: vi.fn(),
  };
  const bar = new WorkspaceSwitcherBar(parent, actions);
  workspaceSwitcherBarTestBar = bar;
  const workspaces = createDefaultWorkspaces();
  bar.setWorkspaces(workspaces, WORKSPACE_IDS.quad);
  return { bar, parent, actions, workspaces };
}

/**
 * Returns the name of a layout of the rig.
 *
 * @param rig Test rig.
 * @param workspaceId Layout id.
 * @returns Layout name.
 */
function workspaceSwitcherBarTestNameRead(rig: WorkspaceSwitcherBarTestRig, workspaceId: string): string {
  const workspace = rig.workspaces.find((candidate) => candidate.id === workspaceId);
  if (!workspace) {
    throw new Error(`Layout ${workspaceId} missing`);
  }
  return workspace.name;
}

/**
 * Opens the chooser menu and clicks the top level row with a label.
 *
 * @param bar Layout chooser.
 * @param label Row label.
 */
function workspaceSwitcherBarTestRowClick(bar: WorkspaceSwitcherBar, label: string): void {
  bar.getTriggerButton().click();
  const panel = bar.getMenuPanel();
  if (!panel || !panel.isOpen()) {
    throw new Error('Layout menu did not open');
  }
  const row = Array.from(panel.getElement().querySelectorAll<HTMLButtonElement>('.editor-toolbar-dropdown-item')).find(
    (button) => (button.querySelector('.editor-toolbar-dropdown-label')?.textContent ?? '') === label,
  );
  if (!row) {
    throw new Error(`Layout menu row ${label} missing`);
  }
  row.click();
}

/**
 * Returns the visible name of the active layout on the trigger.
 *
 * @param bar Layout chooser.
 * @returns Shown name.
 */
function workspaceSwitcherBarTestShownNameRead(bar: WorkspaceSwitcherBar): string {
  return bar.getTriggerButton().querySelector(`.${WORKSPACE_SWITCHER_NAME_CLASS}`)?.textContent ?? '';
}

afterEach(() => {
  workspaceSwitcherBarTestBar?.dispose();
  workspaceSwitcherBarTestBar = null;
  document.body.replaceChildren();
});

describe('WorkspaceSwitcherBar', () => {
  it('is one compact dropdown naming the active layout instead of a row of tabs', () => {
    const rig = workspaceSwitcherBarTestRigCreate();
    expect(rig.bar.getElement().parentElement).toBe(rig.parent);
    expect(rig.bar.getElement().classList.contains(WORKSPACE_SWITCHER_CLASS)).toBe(true);
    expect(rig.bar.getElement().querySelectorAll(':scope > button').length).toBe(1);
    expect(rig.bar.getTriggerButton().getAttribute('aria-haspopup')).toBe('menu');
    expect(workspaceSwitcherBarTestShownNameRead(rig.bar)).toBe(
      workspaceSwitcherBarTestNameRead(rig, WORKSPACE_IDS.quad),
    );
  });

  it('switches from Quad View to Single Perspective and back through the menu', () => {
    const rig = workspaceSwitcherBarTestRigCreate();
    workspaceSwitcherBarTestRowClick(rig.bar, workspaceSwitcherBarTestNameRead(rig, WORKSPACE_IDS.single));
    expect(rig.actions.onSelectWorkspace).toHaveBeenLastCalledWith(WORKSPACE_IDS.single);
    rig.bar.setWorkspaces(rig.workspaces, WORKSPACE_IDS.single);
    expect(workspaceSwitcherBarTestShownNameRead(rig.bar)).toBe(
      workspaceSwitcherBarTestNameRead(rig, WORKSPACE_IDS.single),
    );
    workspaceSwitcherBarTestRowClick(rig.bar, workspaceSwitcherBarTestNameRead(rig, WORKSPACE_IDS.quad));
    expect(rig.actions.onSelectWorkspace).toHaveBeenLastCalledWith(WORKSPACE_IDS.quad);
    expect(rig.actions.onSelectWorkspace).toHaveBeenCalledTimes(2);
  });

  it('does not reselect the layout that is already active', () => {
    const rig = workspaceSwitcherBarTestRigCreate();
    workspaceSwitcherBarTestRowClick(rig.bar, workspaceSwitcherBarTestNameRead(rig, WORKSPACE_IDS.quad));
    expect(rig.actions.onSelectWorkspace).not.toHaveBeenCalled();
  });

  it('deletes and moves the active layout from the menu', () => {
    const rig = workspaceSwitcherBarTestRigCreate();
    rig.bar.setWorkspaces(rig.workspaces, WORKSPACE_IDS.dual);
    const dualIndex = rig.workspaces.findIndex((workspace) => workspace.id === WORKSPACE_IDS.dual);
    workspaceSwitcherBarTestRowClick(rig.bar, 'Move Layout Left');
    expect(rig.actions.onReorderWorkspace).toHaveBeenLastCalledWith(WORKSPACE_IDS.dual, dualIndex - 1);
    workspaceSwitcherBarTestRowClick(rig.bar, 'Delete Layout');
    expect(rig.actions.onDeleteWorkspace).toHaveBeenCalledWith(WORKSPACE_IDS.dual);
  });

  it('renames the active layout in place and reports the new name once', () => {
    const rig = workspaceSwitcherBarTestRigCreate();
    workspaceSwitcherBarTestRowClick(rig.bar, 'Rename Layout…');
    const input = rig.bar.getTriggerButton().querySelector('input');
    if (!input) {
      throw new Error('Rename input missing');
    }
    input.value = 'Brush Work';
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', bubbles: true }));
    expect(rig.actions.onRenameWorkspace).toHaveBeenCalledOnce();
    expect(rig.actions.onRenameWorkspace).toHaveBeenCalledWith(WORKSPACE_IDS.quad, 'Brush Work');
    expect(workspaceSwitcherBarTestShownNameRead(rig.bar)).toBe('Brush Work');
  });

  it('removes itself from the parent on dispose', () => {
    const rig = workspaceSwitcherBarTestRigCreate();
    rig.bar.dispose();
    workspaceSwitcherBarTestBar = null;
    expect(rig.parent.children.length).toBe(0);
  });
});
