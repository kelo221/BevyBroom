import {
  isMenuSeparator,
  isMenuSubmenu,
  type ToolbarMenuAction,
  type ToolbarMenuEntry,
  type ToolbarMenuNativeApplicationSlot,
  type ToolbarMenuNativeRole,
  type ToolbarMenuSubmenu,
} from '@/ui/menu/menu_types.js';
import { nativeMenuAcceleratorFromShortcut } from '@/native_menu/native_menu_accelerator.js';
import type {
  NativeMenuApplicationItemWire,
  NativeMenuBarWire,
  NativeMenuItemActionWire,
  NativeMenuItemWire,
  NativeMenuWire,
} from '@/native_menu/native_menu_types.js';

/** One page menu that becomes a native menu. */
export interface NativeMenuSource {
  /** Menu title. */
  readonly label: string;
  /** Menu entries with their live state functions. */
  readonly entries: readonly ToolbarMenuEntry[];
}

/** Native menu bar together with the page actions its rows run. */
export interface NativeMenuSerialization {
  /** Menu bar sent to the desktop host. */
  readonly bar: NativeMenuBarWire;
  /** Page action of every action id in the menu bar. */
  readonly actions: ReadonlyMap<string, ToolbarMenuAction>;
}

/** Key equivalents of the system clipboard roles. */
const NATIVE_MENU_ROLE_ACCELERATORS: Readonly<Record<ToolbarMenuNativeRole, string>> = Object.freeze({
  cut: 'command+x',
  copy: 'command+c',
  paste: 'command+v',
});

/** Display order of the application menu slots. */
const NATIVE_MENU_APPLICATION_SLOT_ORDER: readonly ToolbarMenuNativeApplicationSlot[] = ['about', 'settings'];

/** Key equivalents of application menu slots. */
const NATIVE_MENU_APPLICATION_SLOT_ACCELERATORS: Readonly<Partial<Record<ToolbarMenuNativeApplicationSlot, string>>> =
  Object.freeze({ settings: 'command+,' });

/**
 * Turns page menus into a native menu bar snapshot: evaluates the live label,
 * enablement and check state of every row, gives each action row a stable path
 * id and remembers which page action each id runs.
 */
export class NativeMenuSerializer {
  private readonly actions = new Map<string, ToolbarMenuAction>();
  private readonly applicationItems: NativeMenuApplicationItemWire[] = [];

  /**
   * Serializes page menus into a native menu bar.
   *
   * @param sources Page menus in menu bar order.
   * @returns Menu bar and the actions of its rows.
   */
  static serialize(sources: readonly NativeMenuSource[]): NativeMenuSerialization {
    const serializer = new NativeMenuSerializer();
    const menus = sources.map((source, menuIndex) => serializer.menuSerialize(source, `${menuIndex}`));
    return { bar: { applicationItems: serializer.applicationItemsSorted(), menus }, actions: serializer.actions };
  }

  /**
   * Serializes one top-level menu.
   *
   * @param source Page menu.
   * @param path Path id of the menu.
   * @returns Native menu.
   */
  private menuSerialize(source: NativeMenuSource, path: string): NativeMenuWire {
    return { label: source.label, items: this.entriesSerialize(source.entries, path) };
  }

  /**
   * Serializes the entries of one menu level and tidies its separators.
   *
   * @param entries Page menu entries.
   * @param path Path id of the menu level.
   * @returns Native rows.
   */
  private entriesSerialize(entries: readonly ToolbarMenuEntry[], path: string): NativeMenuItemWire[] {
    const items: NativeMenuItemWire[] = [];
    entries.forEach((entry, entryIndex) => {
      const item = this.entrySerialize(entry, `${path}/${entryIndex}`);
      if (item) {
        items.push(item);
      }
    });
    return nativeMenuSeparatorsTidy(items);
  }

  /**
   * Serializes one entry, or moves it into the application menu.
   *
   * @param entry Page menu entry.
   * @param path Path id of the entry.
   * @returns Native row, or null when the entry moved to the application menu.
   */
  private entrySerialize(entry: ToolbarMenuEntry, path: string): NativeMenuItemWire | null {
    if (isMenuSeparator(entry)) {
      return { kind: 'separator' };
    }
    if (isMenuSubmenu(entry)) {
      return this.submenuSerialize(entry, path);
    }
    if (entry.nativeRole) {
      const role = entry.nativeRole;
      return { kind: 'role', label: entry.label, role, accelerator: NATIVE_MENU_ROLE_ACCELERATORS[role] };
    }
    return this.actionEntrySerialize(entry, path);
  }

  /**
   * Serializes one action row, or moves it into its application menu slot.
   *
   * @param action Page action row.
   * @param path Path id of the row.
   * @returns Native row, or null when the row moved to the application menu.
   */
  private actionEntrySerialize(action: ToolbarMenuAction, path: string): NativeMenuItemWire | null {
    const slot = action.nativeApplicationSlot;
    const item = this.actionSerialize(action, path, slot ? NATIVE_MENU_APPLICATION_SLOT_ACCELERATORS[slot] : undefined);
    if (!slot) {
      return item;
    }
    this.applicationItems.push({ slot, item });
    return null;
  }

  /**
   * Serializes one action row and remembers its page action.
   *
   * @param action Page action row.
   * @param path Path id of the row.
   * @param fixedAccelerator Key equivalent that replaces the configured one.
   * @returns Native action row.
   */
  private actionSerialize(
    action: ToolbarMenuAction,
    path: string,
    fixedAccelerator: string | undefined,
  ): NativeMenuItemActionWire {
    this.actions.set(path, action);
    const accelerator = fixedAccelerator ?? nativeMenuAcceleratorFromShortcut(action.shortcutBinding?.());
    return {
      kind: 'action',
      label: action.label,
      actionId: path,
      enabled: action.isEnabled?.() ?? true,
      checked: action.isChecked?.() ?? false,
      ...(accelerator ? { accelerator } : {}),
    };
  }

  /**
   * Serializes a submenu row with its live children.
   *
   * @param submenu Page submenu row.
   * @param path Path id of the row.
   * @returns Native submenu row.
   */
  private submenuSerialize(submenu: ToolbarMenuSubmenu, path: string): NativeMenuItemWire {
    const children = submenu.childrenResolve?.() ?? submenu.children;
    return {
      kind: 'submenu',
      label: submenu.label,
      enabled: submenu.isEnabled?.() ?? true,
      items: this.entriesSerialize(children, path),
    };
  }

  /**
   * Returns the collected application menu rows in slot order.
   *
   * @returns Application menu rows.
   */
  private applicationItemsSorted(): NativeMenuApplicationItemWire[] {
    const slotRank = (item: NativeMenuApplicationItemWire): number =>
      NATIVE_MENU_APPLICATION_SLOT_ORDER.indexOf(item.slot);
    return [...this.applicationItems].sort((first, second) => slotRank(first) - slotRank(second));
  }
}

/**
 * Removes leading, trailing and repeated separators from a row list.
 *
 * @param items Native rows.
 * @returns Rows without dangling separators.
 */
export function nativeMenuSeparatorsTidy(items: readonly NativeMenuItemWire[]): NativeMenuItemWire[] {
  const tidied: NativeMenuItemWire[] = [];
  for (const item of items) {
    const previous = tidied[tidied.length - 1];
    const isDangling = item.kind === 'separator' && (!previous || previous.kind === 'separator');
    if (!isDangling) {
      tidied.push(item);
    }
  }
  if (tidied[tidied.length - 1]?.kind === 'separator') {
    tidied.pop();
  }
  return tidied;
}
