import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NATIVE_MENU_BAR_SYNC_REFRESH_INTERVAL_MS, NativeMenuBarSync } from '@/native_menu/native_menu_bar_sync.js';
import { NativeMenuSerializer } from '@/native_menu/native_menu_serializer.js';
import type { NativeMenuItemWire } from '@/native_menu/native_menu_types.js';
import { NativeMenuTestBridge, NativeMenuTestMenus } from './native_menu_test_support.js';

/**
 * Returns the action id of a top-level row.
 *
 * @param menus Page menus.
 * @param label Row label.
 * @returns Action id.
 */
function nativeMenuSyncTestActionIdRead(menus: NativeMenuTestMenus, label: string): string {
  const items: NativeMenuItemWire[] = NativeMenuSerializer.serialize(menus.sourcesCreate()).bar.menus.flatMap(
    (menu) => [...menu.items, ...menu.items.flatMap((item) => (item.kind === 'submenu' ? item.items : []))],
  );
  const item = items.find((candidate) => candidate.kind === 'action' && candidate.label === label);
  return item?.kind === 'action' ? item.actionId : '';
}

describe('NativeMenuBarSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('sends the first snapshot after startup and later only when a row changed', () => {
    const menus = new NativeMenuTestMenus();
    const bridge = new NativeMenuTestBridge();
    const sync = new NativeMenuBarSync(bridge, menus.sourcesCreate(), document);
    sync.start();
    expect(bridge.sentBars).toHaveLength(0);
    vi.advanceTimersByTime(NATIVE_MENU_BAR_SYNC_REFRESH_INTERVAL_MS * 2);
    expect(bridge.sentBars).toHaveLength(1);
    menus.isToggleChecked = true;
    vi.advanceTimersByTime(NATIVE_MENU_BAR_SYNC_REFRESH_INTERVAL_MS);
    expect(bridge.sentBars).toHaveLength(2);
    sync.dispose();
  });

  it('runs chosen rows through the bridge listener and refuses disabled rows', () => {
    const menus = new NativeMenuTestMenus();
    const bridge = new NativeMenuTestBridge();
    const sync = new NativeMenuBarSync(bridge, menus.sourcesCreate(), document);
    sync.start();
    vi.advanceTimersByTime(0);
    expect(bridge.listener?.(nativeMenuSyncTestActionIdRead(menus, 'Plain'))).toBe(true);
    expect(menus.plainAction).toHaveBeenCalledTimes(1);
    menus.isGuardEnabled = false;
    expect(bridge.listener?.(nativeMenuSyncTestActionIdRead(menus, 'Guarded'))).toBe(false);
    expect(menus.guardAction).not.toHaveBeenCalled();
    expect(bridge.listener?.('missing')).toBe(false);
    sync.dispose();
  });

  it('sends undo to a focused text field instead of the editor history', () => {
    const menus = new NativeMenuTestMenus();
    const sync = new NativeMenuBarSync(new NativeMenuTestBridge(), menus.sourcesCreate(), document);
    sync.refresh();
    const undoId = nativeMenuSyncTestActionIdRead(menus, 'Undo');
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    const field = document.createElement('input');
    document.body.appendChild(field);
    field.focus();
    sync.actionRun(undoId);
    expect(execCommand).toHaveBeenCalledWith('undo');
    expect(menus.undoAction).not.toHaveBeenCalled();
    field.blur();
    sync.actionRun(undoId);
    expect(menus.undoAction).toHaveBeenCalledTimes(1);
  });
});
