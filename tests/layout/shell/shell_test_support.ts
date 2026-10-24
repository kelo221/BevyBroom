import type { SelectionQueryId } from '@/selection/query/selection_query.js';
import { vi, type Mock } from 'vitest';
import type { EditorToolbarActions } from '@/layout/shell/builder_editor_shell.js';
import type { HandlerSelectionVisibility } from '@/selection/visibility/handler_selection_visibility.js';
import type { HandlerSolidBrushTools } from '@/tools/csg/solid/handler_solid_brush_tools.js';
import type { ShellWindowActions } from '@/layout/shell/actions/shell_window_actions.js';
import type { ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';
import { ShellStateStore } from '@/layout/shell/state/shell_state_store.js';
import { ShellFrame } from '@/layout/shell/frame/shell_frame.js';
import { ShellInspector } from '@/layout/shell/inspector/shell_inspector.js';
import { ShellInfoPanel } from '@/layout/shell/info_panel/shell_info_panel.js';
import { ShellDockCommands } from '@/layout/shell/actions/shell_dock_commands.js';
import { EditorToolId } from '@/types/editor_tool_id.js';
import type { KeyboardShortcutAction } from '@/settings/store/settings_types.js';
import { isMenuAction, isMenuSubmenu, type ToolbarMenuAction, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/** Toolbar actions whose every member is a vitest spy. */
export type ShellTestToolbarActions = { [Key in keyof EditorToolbarActions]: Mock<EditorToolbarActions[Key]> };

/** Main window docks built for one test, with the storage they persist into. */
export interface ShellTestDocks {
  readonly storage: Storage;
  readonly container: HTMLElement;
  readonly stateStore: ShellStateStore;
  readonly frame: ShellFrame;
  readonly inspector: ShellInspector;
  readonly infoPanel: ShellInfoPanel;
  readonly dockCommands: ShellDockCommands;
}

/**
 * Creates an in-memory browser storage.
 *
 * @returns Storage backed by a map.
 */
export function shellTestStorageCreate(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

/**
 * Creates toolbar actions where every member is a spy created on first read and
 * kept, so a test can assert on the same spy the code under test called.
 *
 * @param overrides Members to use instead of plain spies.
 * @returns Toolbar actions made of spies.
 */
export function shellTestToolbarActionsCreate(
  overrides: Partial<{ [Key in keyof EditorToolbarActions]: EditorToolbarActions[Key] }> = {},
): ShellTestToolbarActions {
  const members = new Map<PropertyKey, unknown>();
  Object.entries(overrides).forEach(([key, member]) => members.set(key, vi.fn(member as () => unknown)));
  return new Proxy({} as ShellTestToolbarActions, {
    get: (_target, property) => shellTestToolbarActionMemberResolve(members, property),
  });
}

/**
 * Returns the cached spy of one toolbar action member, creating it on first
 * read. Symbols and the promise `then` key stay undefined so the object is not
 * thenable.
 *
 * @param members Spies created so far, keyed by member name.
 * @param property Member being read.
 * @returns Spy of the member, or undefined for non-member keys.
 */
function shellTestToolbarActionMemberResolve(members: Map<PropertyKey, unknown>, property: PropertyKey): unknown {
  if (typeof property !== 'string' || property === 'then') {
    return undefined;
  }
  if (!members.has(property)) {
    members.set(property, vi.fn());
  }
  return members.get(property);
}

/**
 * Formats the fake shortcut label the test window actions report.
 *
 * @param action Shortcut action.
 * @returns Label naming the action.
 */
export function shellTestShortcutLabelFormat(action: KeyboardShortcutAction): string {
  return `key:${action}`;
}

/**
 * Window actions that keep a grid size and an active tool, with spies on every
 * member.
 */
export class ShellTestWindowActions implements ShellWindowActions {
  /** Current grid size in meters. */
  gridInterval = 1;
  /** Currently active tool. */
  activeToolId: EditorToolId = EditorToolId.OBJECT;
  /** Listeners registered for grid size changes. */
  private readonly gridIntervalListeners: Array<(interval: number) => void> = [];
  /** Spy for selecting everything. */
  readonly selectAll = vi.fn<() => void>();
  /** Spy for clearing the selection. */
  readonly selectNone = vi.fn<() => void>();
  /** Spy for cycling the hovered view. */
  readonly viewCycle = vi.fn<() => void>();
  /** Spy for maximizing the hovered view. */
  readonly viewMaximize = vi.fn<() => void>();
  /** Spy for framing the selection. */
  readonly frameSelection = vi.fn<() => void>();
  /** Spy for framing the selection in all views. */
  readonly frameAll = vi.fn<() => void>();
  /** Spy for starting play mode. */
  readonly playStart = vi.fn<() => void>();
  /** Spy that records the chosen tool as the active one. */
  readonly toolSelect = vi.fn((toolId: EditorToolId) => this.activeToolIdWrite(toolId));
  /** Spy that returns the active tool. */
  readonly toolActiveRead = vi.fn(() => this.activeToolId);
  /** Spy that returns the grid size. */
  readonly gridIntervalRead = vi.fn(() => this.gridInterval);
  /** Spy that changes the grid size and tells the listeners. */
  readonly gridIntervalSet = vi.fn((interval: number) => this.gridIntervalChange(interval));
  /** Spy that registers a grid size listener. */
  readonly gridIntervalChangeListenerAdd = vi.fn((listener: (interval: number) => void) =>
    this.gridIntervalListenerStore(listener),
  );
  /** Spy that returns the fake shortcut label of an action. */
  readonly shortcutLabelRead = vi.fn((action: KeyboardShortcutAction) => shellTestShortcutLabelFormat(action));
  /** Whether the clipboard commands see selected objects. */
  clipboardSelectionHasObjects = false;
  /** Spy for copying the selection. */
  readonly clipboardCopy = vi.fn<() => void>();
  /** Spy for cutting the selection. */
  readonly clipboardCut = vi.fn<() => void>();
  /** Spy for pasting under the pointer. */
  readonly clipboardPaste = vi.fn<() => void>();
  /** Spy for pasting at the original position. */
  readonly clipboardPasteAtOriginalPosition = vi.fn<() => void>();
  /** Spy that returns whether objects are selected. */
  readonly clipboardSelectionHasObjectsIs = vi.fn(() => this.clipboardSelectionHasObjects);
  /** Spy for running a selection query. */
  readonly selectionQueryRun = vi.fn((_queryId: SelectionQueryId) => 0);
  /**
   * Spy that returns whether objects are selected, shared with the clipboard
   * flag.
   */
  readonly selectionHasObjectsIs = vi.fn(() => this.clipboardSelectionHasObjects);
  /** Brush tools the menus and toolbar run, or null for none. */
  solidBrushTools: HandlerSolidBrushTools | null = null;
  /** Spy that returns the brush tools. */
  readonly solidBrushToolsRead = vi.fn(() => this.solidBrushTools);
  /** Hide, Isolate and Show All commands the menus run, or null for none. */
  selectionVisibility: HandlerSelectionVisibility | null = null;
  /** Spy that returns the visibility commands. */
  readonly selectionVisibilityRead = vi.fn(() => this.selectionVisibility);

  /**
   * Changes the grid size and tells every registered listener.
   *
   * @param interval New grid size in meters.
   */
  gridIntervalChange(interval: number): void {
    this.gridInterval = interval;
    this.gridIntervalListeners.forEach((listener) => listener(interval));
  }

  /**
   * Returns how many grid size listeners are registered.
   *
   * @returns Listener count.
   */
  gridIntervalListenerCount(): number {
    return this.gridIntervalListeners.length;
  }

  /**
   * Stores a grid size listener.
   *
   * @param listener Listener to store.
   */
  private gridIntervalListenerStore(listener: (interval: number) => void): void {
    this.gridIntervalListeners.push(listener);
  }

  /**
   * Records the active tool.
   *
   * @param toolId Tool that becomes active.
   */
  private activeToolIdWrite(toolId: EditorToolId): void {
    this.activeToolId = toolId;
  }
}

/**
 * Builds the main window frame, inspector, info panel and dock commands in a
 * mounted container, persisting into the given storage.
 *
 * @param storage Storage the shell state is kept in.
 * @returns Docks and the objects they were built from.
 */
export function shellTestDocksCreate(storage: Storage = shellTestStorageCreate()): ShellTestDocks {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const stateStore = new ShellStateStore(storage);
  const frame = new ShellFrame(container, stateStore);
  const inspector = new ShellInspector(stateStore);
  const infoPanel = new ShellInfoPanel(stateStore);
  frame.inspectorHostRead().appendChild(inspector.getElement());
  frame.infoPanelHostRead().appendChild(infoPanel.getElement());
  const dockCommands = new ShellDockCommands(frame, inspector, infoPanel);
  return { storage, container, stateStore, frame, inspector, infoPanel, dockCommands };
}

/**
 * Removes docks built by {@link shellTestDocksCreate} from the document.
 *
 * @param docks Docks to remove.
 */
export function shellTestDocksDispose(docks: ShellTestDocks): void {
  docks.inspector.dispose();
  docks.infoPanel.dispose();
  docks.frame.dispose();
  docks.container.remove();
}

/**
 * Builds a menu context over spy toolbar actions, test window actions and real
 * docks.
 *
 * @param docks Docks whose commands the menus run.
 * @param toolbarActions Toolbar actions the menus run.
 * @param windowActions Window actions the menus run.
 * @returns Menu context.
 */
export function shellTestMenuContextCreate(
  docks: ShellTestDocks,
  toolbarActions: ShellTestToolbarActions = shellTestToolbarActionsCreate(),
  windowActions: ShellTestWindowActions = new ShellTestWindowActions(),
): ShellMenuContext {
  return { toolbarActions, windowActions, dockCommands: docks.dockCommands };
}

/**
 * Lists the labels of the action and submenu rows of a menu, skipping
 * separators.
 *
 * @param entries Menu entries.
 * @returns Row labels in display order.
 */
export function shellTestMenuLabelsRead(entries: readonly ToolbarMenuEntry[]): string[] {
  return entries.flatMap((entry) => (isMenuAction(entry) || isMenuSubmenu(entry) ? [entry.label] : []));
}

/**
 * Returns the children of the submenu row with a label.
 *
 * @param entries Menu entries holding the submenu.
 * @param label Submenu label.
 * @returns Child entries.
 */
export function shellTestMenuSubmenuChildrenRead(
  entries: readonly ToolbarMenuEntry[],
  label: string,
): ToolbarMenuEntry[] {
  const submenu = entries.find((entry) => isMenuSubmenu(entry) && entry.label === label);
  if (!submenu || !isMenuSubmenu(submenu)) {
    throw new Error(`Submenu ${label} not found`);
  }
  return submenu.childrenResolve ? submenu.childrenResolve() : submenu.children;
}

/**
 * Returns the action row reached by following submenu labels down to a row
 * label.
 *
 * @param entries Top-level menu entries.
 * @param labelPath Submenu labels followed by the action label.
 * @returns Action entry.
 */
export function shellTestMenuActionFind(
  entries: readonly ToolbarMenuEntry[],
  ...labelPath: string[]
): ToolbarMenuAction {
  const submenuLabels = labelPath.slice(0, -1);
  const actionLabel = labelPath[labelPath.length - 1];
  const level = submenuLabels.reduce<readonly ToolbarMenuEntry[]>(
    (current, label) => shellTestMenuSubmenuChildrenRead(current, label),
    entries,
  );
  const action = level.find((entry) => isMenuAction(entry) && entry.label === actionLabel);
  if (!action || !isMenuAction(action)) {
    throw new Error(`Menu action ${labelPath.join(' > ')} not found`);
  }
  return action;
}

/**
 * Returns the shortcut text an action row shows.
 *
 * @param action Action entry.
 * @returns Shortcut text, or null when the row has none.
 */
export function shellTestMenuShortcutRead(action: ToolbarMenuAction): string | null {
  const shortcut = action.shortcut;
  if (shortcut === undefined) {
    return null;
  }
  return (typeof shortcut === 'function' ? shortcut() : shortcut) ?? null;
}
