import { describe, expect, it } from 'vitest';
import {
  DockLayoutMemoryStorage,
  dockWindowLayoutDefault,
  dockWindowLayoutsSanitize,
} from '@/ui/dock/state/dock_window_layout.js';

/** Saved tool window placements are read back safely and kept per window. */
describe('dock window layouts', () => {
  it('reads saved placements and replaces broken parts with defaults', () => {
    const floatingRect = { left: 10, top: 20, width: 300, height: 200 };
    const layouts = dockWindowLayoutsSanitize({
      docked: { side: 'bottom', floatingRect, isOpen: true },
      broken: { side: 'top', floatingRect: { left: 'x' }, isOpen: 'yes' },
      missing: null,
    });
    expect(layouts['docked']).toEqual({ side: 'bottom', floatingRect, isOpen: true });
    expect(layouts['broken']).toEqual(dockWindowLayoutDefault());
    expect(layouts['missing']).toEqual(dockWindowLayoutDefault());
    expect(dockWindowLayoutsSanitize('layouts')).toEqual({});
  });

  it('keeps placements per window in memory and forgets them on clear', () => {
    const storage = new DockLayoutMemoryStorage();
    storage.windowLayoutWrite('window_a', { side: 'left', floatingRect: null, isOpen: true });
    expect(storage.windowLayoutRead('window_a').side).toBe('left');
    expect(storage.windowLayoutRead('window_b')).toEqual(dockWindowLayoutDefault());
    storage.windowLayoutsClear();
    expect(storage.windowLayoutRead('window_a')).toEqual(dockWindowLayoutDefault());
  });
});
