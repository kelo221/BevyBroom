import { vi } from 'vitest';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import type { NativeMenuSource } from '@/native_menu/native_menu_serializer.js';
import type { NativeMenuBridge, NativeMenuActionListener } from '@/native_menu/native_menu_bridge.js';
import type { NativeMenuBarWire } from '@/native_menu/native_menu_types.js';

/** Page menus with live state switches and spies on every action. */
export class NativeMenuTestMenus {
  /** Whether the toggled row is checked. */
  isToggleChecked = false;
  /** Whether the guarded row is enabled. */
  isGuardEnabled = true;
  /** Spy of the plain action row. */
  readonly plainAction = vi.fn();
  /** Spy of the guarded action row. */
  readonly guardAction = vi.fn();
  /** Spy of the undo row. */
  readonly undoAction = vi.fn();
  /** Spy of the settings row. */
  readonly settingsAction = vi.fn();

  /**
   * Builds the page menus.
   *
   * @returns Two menus covering every row kind.
   */
  sourcesCreate(): NativeMenuSource[] {
    return [
      { label: 'File', entries: this.fileEntriesCreate() },
      { label: 'Edit', entries: this.editEntriesCreate() },
    ];
  }

  /**
   * Builds the File menu entries with a settings row and dangling separators.
   *
   * @returns Menu entries.
   */
  private fileEntriesCreate(): ToolbarMenuEntry[] {
    return [
      { kind: 'separator' },
      { label: 'Plain', onClick: this.plainAction },
      { kind: 'separator' },
      { kind: 'separator' },
      { label: 'Toggle', onClick: () => undefined, isChecked: () => this.isToggleChecked },
      { kind: 'separator' },
      { label: 'Settings', onClick: this.settingsAction, nativeApplicationSlot: 'settings' },
    ];
  }

  /**
   * Builds the Edit menu entries with a role, a text command and a submenu.
   *
   * @returns Menu entries.
   */
  private editEntriesCreate(): ToolbarMenuEntry[] {
    const shortcut = { code: 'KeyZ', ctrl: true, shift: false, alt: false, meta: false };
    return [
      { label: 'Undo', onClick: this.undoAction, textEditCommand: 'undo', shortcutBinding: () => shortcut },
      { label: 'Copy', onClick: () => undefined, nativeRole: 'copy' },
      {
        kind: 'submenu',
        label: 'More',
        children: [],
        childrenResolve: () => [{ label: 'Guarded', onClick: this.guardAction, isEnabled: () => this.isGuardEnabled }],
      },
    ];
  }
}

/** Native menu bridge that records every menu bar it receives. */
export class NativeMenuTestBridge implements NativeMenuBridge {
  /** Menu bars received, oldest first. */
  readonly sentBars: NativeMenuBarWire[] = [];
  /** Listener set by the sync. */
  listener: NativeMenuActionListener | null = null;

  /**
   * Records a menu bar.
   *
   * @param bar Menu bar snapshot.
   */
  menuBarSet(bar: NativeMenuBarWire): void {
    this.sentBars.push(bar);
  }

  /**
   * Stores the listener.
   *
   * @param listener Listener of chosen rows.
   */
  actionListenerSet(listener: NativeMenuActionListener): void {
    this.listener = listener;
  }
}
