import type * as THREE from 'three';
import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { TabBook } from '@/ui/tabs/tab_book.js';
import { buttonCompactCreate, buttonCompactEnabledWrite } from '@/ui/button/button_compact.js';
import type { UndoCommand } from '@/commands/command_undo.js';
import { CommandUndoBatch } from '@/commands/command_undo_batch.js';
import type { StateCordon } from '@/cordon/state_cordon.js';
import type { CordonFilterApplier } from '@/cordon/cordon_filter_applier.js';
import { VisGroupClassifierAuto } from '../visgroup_classifier_auto.js';
import type { VisGroupStore } from '../visgroup_store.js';
import { visGroupIdAutoIs, type AutoVisGroupNode, type VisGroupSelectionTarget } from '../visgroup_types.js';
import { CommandVisGroupUserCreate } from '../commands/command_visgroup_user_create.js';
import { CommandVisGroupMembershipAdd } from '../commands/command_visgroup_membership_add.js';

/** Class name of a VisGroup row while it is the highlighted one. */
export const PANEL_VISGROUPS_ROW_SELECTED_CLASS = 'visgroup-row-selected';

/** Class name of the bordered User and Auto list boxes. */
export const PANEL_VISGROUPS_LIST_CLASS = 'panel-visgroups-list';

/** Class name of the hint a list shows while it holds no VisGroup. */
export const PANEL_VISGROUPS_EMPTY_HINT_CLASS = 'panel-visgroups-empty-hint';

/** Minimum height of the User and Auto list boxes in pixels. */
export const PANEL_VISGROUPS_LIST_MIN_HEIGHT_PX = 120;

/** Hint the User list shows while there is no user VisGroup. */
const PANEL_VISGROUPS_USER_EMPTY_HINT = 'No VisGroups yet. Select objects and click Edit to make one.';

/** Editor services the VisGroups panel acts on. */
export interface PanelVisGroupsServices {
  /** VisGroup store. */
  readonly store: VisGroupStore;
  /** Cordon bounds state. */
  readonly cordonState: StateCordon;
  /** Cordon filter applier. */
  readonly cordonApplier: CordonFilterApplier;
  /** Scene world root. */
  readonly worldRoot: THREE.Object3D;
  /** Selection target for Mark and Assign actions. */
  readonly selectionTarget: VisGroupSelectionTarget;
  /** Records and runs an undoable command. */
  readonly commandRun: (command: UndoCommand) => void;
  /** Runs after the panel showed or hid objects. */
  readonly afterVisibilityChange: () => void;
}

/**
 * Hammer++-style VisGroups panel with User, Auto, and Cordon tabs plus Show,
 * Edit (New Group), and Mark action buttons.
 */
export class PanelVisGroups {
  private readonly root: HTMLElement;
  private readonly tabBook: TabBook;
  private readonly services: PanelVisGroupsServices;
  private readonly userListHost: HTMLElement;
  private readonly autoListHost: HTMLElement;
  private readonly showButton: HTMLButtonElement;
  private readonly markButton: HTMLButtonElement;
  private selectedGroupId: string | null;
  private readonly unsubscribeStore: () => void;

  /**
   * Creates the VisGroups panel inside a parent element.
   *
   * @param parent Container element.
   * @param services Store, Cordon, world, selection and command services.
   */
  constructor(parent: HTMLElement, services: PanelVisGroupsServices) {
    this.services = services;
    this.selectedGroupId = 'all';
    this.root = this.rootCreate(parent);
    this.root.appendChild(this.captionCreate());
    this.userListHost = this.listContainerCreate();
    this.autoListHost = this.listContainerCreate();
    this.tabBook = this.tabBookBuild();
    this.root.appendChild(this.tabBook.getElement());
    this.showButton = this.footerButtonCreate('Show', () => this.showSelectedGroup());
    this.markButton = this.footerButtonCreate('Mark', () => this.markSelectedGroup());
    this.actionFooterMount();
    this.refreshLists();
    this.unsubscribeStore = services.store.changeListenerAdd(() => this.refreshLists());
  }

  /**
   * Returns the panel root element.
   *
   * @returns Root element.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /**
   * Returns the id of the highlighted VisGroup.
   *
   * @returns Highlighted VisGroup id, or null when none is highlighted.
   */
  selectedGroupIdRead(): string | null {
    return this.selectedGroupId;
  }

  /** Disposes listeners and removes the panel from the DOM. */
  dispose(): void {
    this.unsubscribeStore();
    this.tabBook.dispose();
    this.root.remove();
  }

  /**
   * Creates and configures the User, Auto, and Cordon tabs.
   *
   * @returns Configured TabBook instance.
   */
  private tabBookBuild(): TabBook {
    const book = new TabBook({ ariaLabel: 'VisGroups' });
    book.tabAdd({ id: 'user', label: 'User', pageResolve: () => this.userListHost });
    book.tabAdd({ id: 'auto', label: 'Auto', pageResolve: () => this.autoListHost });
    book.tabAdd({ id: 'cordon', label: 'Cordon', pageResolve: () => this.cordonPageCreate() });
    book.pagesMountAll();
    return book;
  }

  /**
   * Creates the outer flex column for the VisGroups panel.
   *
   * @param parent Parent container.
   * @returns Root element.
   */
  private rootCreate(parent: HTMLElement): HTMLElement {
    const root = document.createElement('div');
    root.classList.add('panel-visgroups');
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.flex = '1 1 auto';
    root.style.minHeight = '0';
    parent.appendChild(root);
    return root;
  }

  /**
   * Creates the Hammer++ "VisGroups:" caption above the tabs.
   *
   * @returns Caption element.
   */
  private captionCreate(): HTMLElement {
    const caption = document.createElement('div');
    caption.classList.add('panel-visgroups-caption');
    caption.textContent = 'VisGroups:';
    caption.style.fontSize = '11px';
    caption.style.fontFamily = Theme.uiFontFamily;
    caption.style.color = Theme.statusBarTextColor;
    caption.style.padding = '6px 8px 2px';
    return caption;
  }

  /**
   * Shows or hides the members of a VisGroup and reports the visibility change.
   *
   * @param groupId User or Auto VisGroup id.
   * @param visible True to show the members.
   */
  private groupVisibilityWrite(groupId: string, visible: boolean): void {
    this.services.store.groupVisibleSet(groupId, visible, this.services.worldRoot);
    this.services.afterVisibilityChange();
  }

  /** Applies the Cordon filter to the world and reports the visibility change. */
  private cordonFilterApply(): void {
    this.services.cordonApplier.apply(this.services.worldRoot);
    this.services.afterVisibilityChange();
  }

  /**
   * Creates a scrollable list container for a tab page.
   *
   * @returns List container.
   */
  private listContainerCreate(): HTMLElement {
    const list = document.createElement('div');
    list.classList.add(PANEL_VISGROUPS_LIST_CLASS);
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '1px';
    list.style.padding = '2px';
    list.style.margin = '4px 8px';
    list.style.minHeight = `${PANEL_VISGROUPS_LIST_MIN_HEIGHT_PX}px`;
    list.style.maxHeight = '180px';
    list.style.overflowY = 'auto';
    list.style.boxSizing = 'border-box';
    list.style.border = `1px solid ${Theme.inputBorderColor}`;
    list.style.borderRadius = '2px';
    list.style.background = hexToRgb(Theme.outlinerBackground);
    return list;
  }

  /**
   * Creates the hint a list shows while it holds no VisGroup.
   *
   * @param text Hint text.
   * @returns Hint element.
   */
  private listEmptyHintCreate(text: string): HTMLElement {
    const hint = document.createElement('div');
    hint.classList.add(PANEL_VISGROUPS_EMPTY_HINT_CLASS);
    hint.textContent = text;
    hint.style.padding = '8px 6px';
    hint.style.fontSize = '11px';
    hint.style.fontFamily = Theme.uiFontFamily;
    hint.style.color = Theme.statusBarTextColor;
    hint.style.whiteSpace = 'normal';
    return hint;
  }

  /**
   * Re-renders both User and Auto VisGroup checkbox trees and drops a highlight
   * whose VisGroup no longer exists.
   */
  private refreshLists(): void {
    this.userListRender();
    this.autoListHost.replaceChildren();
    this.autoNodeRender(VisGroupClassifierAuto.treeBuild(), 0);
    if (this.selectedGroupId !== null && !this.groupExistsIs(this.selectedGroupId)) {
      this.selectedGroupId = null;
    }
    this.selectionDisplayRefresh();
  }

  /** Re-renders the User list, or its empty hint when there is no user VisGroup. */
  private userListRender(): void {
    const groups = this.services.store.userGroupsList();
    this.userListHost.replaceChildren(...groups.map((group) => this.groupRowCreate(group.id, group.name, 0)));
    if (groups.length === 0) {
      this.userListHost.appendChild(this.listEmptyHintCreate(PANEL_VISGROUPS_USER_EMPTY_HINT));
    }
  }

  /**
   * Returns whether a VisGroup id names an automatic or an existing user group.
   *
   * @param groupId VisGroup id.
   * @returns True when the VisGroup exists.
   */
  private groupExistsIs(groupId: string): boolean {
    return visGroupIdAutoIs(groupId) || this.services.store.userGroupFind(groupId) !== null;
  }

  /**
   * Recursively renders an Auto VisGroup tree node and its children.
   *
   * @param node Auto VisGroup node.
   * @param depth Indentation depth.
   */
  private autoNodeRender(node: AutoVisGroupNode, depth: number): void {
    this.autoListHost.appendChild(this.groupRowCreate(node.id, node.label, depth));
    node.children.forEach((child) => this.autoNodeRender(child, depth + 1));
  }

  /**
   * Builds a single VisGroup row with visibility checkbox and selection click.
   *
   * @param groupId User or Auto VisGroup id.
   * @param label Display name.
   * @param depth Indentation level.
   * @returns Row element.
   */
  private groupRowCreate(groupId: string, label: string, depth: number): HTMLElement {
    const row = this.groupRowShellCreate(groupId, depth);
    row.addEventListener('click', () => this.groupSelect(groupId));
    row.append(this.checkboxCreate(groupId), this.groupRowLabelCreate(label));
    return row;
  }

  /**
   * Creates the indented row container of a VisGroup.
   *
   * @param groupId User or Auto VisGroup id.
   * @param depth Indentation level.
   * @returns Row container.
   */
  private groupRowShellCreate(groupId: string, depth: number): HTMLElement {
    const row = document.createElement('div');
    row.classList.add('visgroup-row');
    row.dataset['visgroupId'] = groupId;
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';
    row.style.padding = `2px 4px 2px ${4 + depth * 12}px`;
    row.style.borderLeft = '2px solid transparent';
    row.style.cursor = 'pointer';
    return row;
  }

  /**
   * Creates the name label of a VisGroup row.
   *
   * @param label Display name.
   * @returns Label element.
   */
  private groupRowLabelCreate(label: string): HTMLElement {
    const text = document.createElement('span');
    text.textContent = label;
    text.style.fontSize = '11px';
    text.style.fontFamily = Theme.uiFontFamily;
    text.style.color = Theme.buttonTextColor;
    return text;
  }

  /**
   * Highlights a VisGroup as the one the footer buttons act on.
   *
   * @param groupId User or Auto VisGroup id.
   */
  private groupSelect(groupId: string): void {
    this.selectedGroupId = groupId;
    this.selectionDisplayRefresh();
  }

  /** Paints the highlighted row and enables the footer buttons that need it. */
  private selectionDisplayRefresh(): void {
    this.root.querySelectorAll<HTMLElement>('.visgroup-row').forEach((row) => {
      this.groupRowSelectedPaint(row, row.dataset['visgroupId'] === this.selectedGroupId);
    });
    const hasSelection = this.selectedGroupId !== null;
    buttonCompactEnabledWrite(this.showButton, hasSelection);
    buttonCompactEnabledWrite(this.markButton, hasSelection);
  }

  /**
   * Paints one row as highlighted or plain.
   *
   * @param row VisGroup row.
   * @param isSelected True when the row is the highlighted VisGroup.
   */
  private groupRowSelectedPaint(row: HTMLElement, isSelected: boolean): void {
    row.classList.toggle(PANEL_VISGROUPS_ROW_SELECTED_CLASS, isSelected);
    row.style.background = isSelected ? Theme.outlinerSelectedColor : 'transparent';
    row.style.borderLeftColor = isSelected ? hexToRgb(Theme.selectionColor) : 'transparent';
  }

  /**
   * Creates the visibility checkbox for a VisGroup row.
   *
   * @param groupId VisGroup id.
   * @returns Checkbox input element.
   */
  private checkboxCreate(groupId: string): HTMLInputElement {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.services.store.groupVisibleIs(groupId);
    checkbox.addEventListener('change', (event) => {
      event.stopPropagation();
      this.groupVisibilityWrite(groupId, checkbox.checked);
    });
    return checkbox;
  }

  /**
   * Builds the Cordon tab page with active toggle and Fit to Selection button.
   *
   * @returns Cordon page element.
   */
  private cordonPageCreate(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '6px';
    wrap.style.padding = '6px';
    const toggleBtn = this.footerButtonCreate('Toggle Cordon Active', () => this.cordonActiveToggle());
    toggleBtn.classList.add('visgroup-cordon-toggle');
    const fitBtn = this.footerButtonCreate('Fit Cordon to Selection', () => this.cordonFitToSelection());
    fitBtn.classList.add('visgroup-cordon-fit');
    wrap.append(toggleBtn, fitBtn);
    return wrap;
  }

  /** Switches the Cordon on or off and reapplies its filter. */
  private cordonActiveToggle(): void {
    this.services.cordonState.enabledWrite(!this.services.cordonState.enabledRead());
    this.cordonFilterApply();
  }

  /** Fits the Cordon bounds to the selection and reapplies its filter. */
  private cordonFitToSelection(): void {
    this.services.cordonState.fitToObjects(this.services.selectionTarget.getInspectorObjects());
    this.cordonFilterApply();
  }

  /** Mounts the Hammer++ Show, Edit (New Group), and Mark footer buttons. */
  private actionFooterMount(): void {
    const footer = document.createElement('div');
    footer.classList.add('panel-visgroups-footer');
    footer.style.display = 'flex';
    footer.style.gap = '4px';
    footer.style.padding = '4px 6px';
    footer.style.borderTop = `1px solid ${hexToRgb(Theme.separatorColor)}`;
    const editBtn = this.footerButtonCreate('Edit', () => this.createAndAssignGroup());
    footer.append(this.showButton, editBtn, this.markButton);
    this.root.appendChild(footer);
  }

  /** Toggles visibility of the currently highlighted VisGroup. */
  private showSelectedGroup(): void {
    if (!this.selectedGroupId) return;
    this.groupVisibilityWrite(this.selectedGroupId, !this.services.store.groupVisibleIs(this.selectedGroupId));
  }

  /**
   * Creates a new user VisGroup holding the current selection as one undoable
   * step and highlights it.
   */
  private createAndAssignGroup(): void {
    const store = this.services.store;
    const groupCreate = new CommandVisGroupUserCreate(store, `Group ${store.userGroupsList().length + 1}`);
    const groupId = groupCreate.groupIdRead();
    const membershipAdd = new CommandVisGroupMembershipAdd(
      store,
      this.services.selectionTarget.getInspectorObjects(),
      groupId,
    );
    this.selectedGroupId = groupId;
    this.services.commandRun(new CommandUndoBatch([groupCreate, membershipAdd]));
    this.selectionDisplayRefresh();
  }

  /** Marks (selects) all visible objects in the currently highlighted VisGroup. */
  private markSelectedGroup(): void {
    if (!this.selectedGroupId) return;
    this.services.store.groupMembersMark(this.selectedGroupId, this.services.worldRoot, this.services.selectionTarget);
  }

  /**
   * Creates a compact button that shares the footer row width evenly.
   *
   * @param label Button text.
   * @param onClick Click handler.
   * @returns Button element.
   */
  private footerButtonCreate(label: string, onClick: () => void): HTMLButtonElement {
    const button = buttonCompactCreate({ title: label, widthPx: null, heightPx: 22, onClick });
    button.style.flex = '1 1 0';
    return button;
  }
}
