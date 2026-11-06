import { Theme } from '@/theme.js';
import type { WorkspaceDefinition } from '@/layout/workspace/workspace_definition.js';
import { InputInlineRename } from '@/ui/input/input_inline_rename.js';
import { PanelMenu } from '@/ui/menu/panel_menu.js';
import { PanelMenuDropdown } from '@/ui/menu/panel_menu_dropdown.js';
import { workspaceSwitcherMenuEntriesBuild, type WorkspaceSwitcherMenuActions } from './workspace_switcher_menu.js';

/** Callbacks for layout chooser actions. */
export interface WorkspaceSwitcherBarActions extends Omit<WorkspaceSwitcherMenuActions, 'onRenameActiveBegin'> {
  /**
   * Renames a layout in persistence only (the chooser updates its label
   * itself).
   *
   * @param workspaceId Target layout id.
   * @param name New display name.
   */
  onRenameWorkspace(workspaceId: string, name: string): void;
}

/** CSS class of the layout chooser wrapper. */
export const WORKSPACE_SWITCHER_CLASS = 'editor-workspace-switcher';

/** CSS class of the active layout name inside the chooser button. */
export const WORKSPACE_SWITCHER_NAME_CLASS = 'editor-workspace-switcher-name';

/**
 * Compact layout chooser: a dropdown button naming the active layout whose menu
 * switches layouts, adds a layout from a template or a copy, and renames, moves
 * or deletes the active layout.
 */
export class WorkspaceSwitcherBar extends PanelMenuDropdown {
  private readonly actions: WorkspaceSwitcherBarActions;
  private readonly nameLabel: HTMLSpanElement;
  private workspaces: readonly WorkspaceDefinition[];
  private activeId: string;
  private activeRename: InputInlineRename | null;

  /**
   * Creates the chooser inside a parent element.
   *
   * @param parent Parent element, typically a toolbar slot.
   * @param actions User action callbacks.
   */
  constructor(parent: HTMLElement, actions: WorkspaceSwitcherBarActions) {
    super(parent);
    this.actions = actions;
    this.workspaces = [];
    this.activeId = '';
    this.activeRename = null;
    this.nameLabel = this.ownerDocument.createElement('span');
    this.chromeBuild();
    parent.appendChild(this.wrapper);
  }

  /**
   * Shows the active layout name and remembers the layouts for the menu.
   *
   * @param workspaces Available layouts in display order.
   * @param activeId Active layout id.
   */
  setWorkspaces(workspaces: readonly WorkspaceDefinition[], activeId: string): void {
    this.workspaces = workspaces;
    this.activeId = activeId;
    if (this.activeRename) {
      return;
    }
    this.nameLabelRefresh();
  }

  /**
   * Returns the button that opens the layout menu.
   *
   * @returns Trigger button.
   */
  getTriggerButton(): HTMLButtonElement {
    return this.button;
  }

  /** Ends a rename, closes the menu and removes the chooser from the DOM. */
  override dispose(): void {
    this.renameDispose();
    super.dispose();
  }

  /** Opens the menu unless the active layout is being renamed. */
  protected override toggleMenu(): void {
    if (this.activeRename) {
      return;
    }
    super.toggleMenu();
  }

  /** Rebuilds the menu panel from the current layouts. */
  protected rebuildMenuPanel(): void {
    this.menuPanel?.dispose();
    const entries = workspaceSwitcherMenuEntriesBuild(this.workspaces, this.activeId, this.menuActionsBuild());
    this.menuPanel = new PanelMenu(entries, () => this.closeMenu(), false, this.ownerDocument);
    this.wrapper.appendChild(this.menuPanel.getElement());
  }

  /** Styles the trigger like the other toolbar buttons. */
  protected styleTriggerButton(): void {
    this.button.style.display = 'inline-flex';
    this.button.style.alignItems = 'center';
    this.button.style.gap = '3px';
    this.button.style.height = `${Theme.toolbarButtonPx}px`;
    this.button.style.padding = '0 6px';
    this.button.style.border = `1px solid ${Theme.chromeBorderColor}`;
    this.button.style.borderRadius = '2px';
    this.button.style.background = Theme.panelBackground;
    this.button.style.color = Theme.buttonTextColor;
    this.button.style.fontFamily = Theme.uiFontFamily;
    this.button.style.fontSize = `${Theme.uiFontSizePx}px`;
    this.button.style.whiteSpace = 'nowrap';
    this.button.style.cursor = 'pointer';
  }

  /** Builds the trigger with the name label and caret and an empty menu. */
  private chromeBuild(): void {
    this.wrapper.classList.add(WORKSPACE_SWITCHER_CLASS);
    this.wrapper.style.flex = '0 0 auto';
    this.nameLabel.classList.add(WORKSPACE_SWITCHER_NAME_CLASS);
    this.styleTriggerButton();
    this.button.appendChild(this.nameLabel);
    this.appendCaret(this.button);
    this.wrapper.appendChild(this.button);
    this.nameLabelRefresh();
    this.rebuildMenuPanel();
  }

  /** Shows the active layout name on the trigger and in its tooltip. */
  private nameLabelRefresh(): void {
    const name = this.activeNameRead();
    this.nameLabel.textContent = name;
    this.button.title = `Layout: ${name}`;
    this.button.setAttribute('aria-label', `Layout: ${name}`);
  }

  /**
   * Returns the name of the active layout.
   *
   * @returns Name, or an empty string when the active layout is unknown.
   */
  private activeNameRead(): string {
    return this.workspaces.find((workspace) => workspace.id === this.activeId)?.name ?? '';
  }

  /**
   * Builds the menu callbacks, closing the menu before each action.
   *
   * @returns Menu actions.
   */
  private menuActionsBuild(): WorkspaceSwitcherMenuActions {
    return {
      onSelectWorkspace: (workspaceId) => this.actions.onSelectWorkspace(workspaceId),
      onAddPresetWorkspace: (template) => this.actions.onAddPresetWorkspace(template),
      onDuplicateCurrent: () => this.actions.onDuplicateCurrent(),
      onDeleteWorkspace: (workspaceId) => this.actions.onDeleteWorkspace(workspaceId),
      onReorderWorkspace: (workspaceId, toIndex) => this.actions.onReorderWorkspace(workspaceId, toIndex),
      onRenameActiveBegin: () => this.renameBegin(),
    };
  }

  /** Replaces the name label with an inline rename input for the active layout. */
  private renameBegin(): void {
    this.closeMenu();
    this.renameDispose();
    const workspaceId = this.activeId;
    const originalName = this.activeNameRead();
    const rename = new InputInlineRename(this.button, this.nameLabel, originalName);
    this.activeRename = rename;
    rename.setConfirmCallback((newName) => this.renameConfirm(workspaceId, originalName, newName));
    rename.setCancelCallback(() => {
      this.activeRename = null;
    });
    rename.activate();
  }

  /**
   * Applies a confirmed rename to the label and reports it when the name
   * changed.
   *
   * @param workspaceId Renamed layout id.
   * @param originalName Name before the rename.
   * @param newName Confirmed name.
   */
  private renameConfirm(workspaceId: string, originalName: string, newName: string): void {
    this.activeRename = null;
    this.workspaces = this.workspaces.map((item) => (item.id === workspaceId ? { ...item, name: newName } : item));
    this.nameLabelRefresh();
    if (newName !== originalName) {
      this.actions.onRenameWorkspace(workspaceId, newName);
    }
  }

  /** Ends an in-progress rename without applying it. */
  private renameDispose(): void {
    this.activeRename?.dispose();
    this.activeRename = null;
  }
}
