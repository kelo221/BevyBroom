import { describe, expect, it } from 'vitest';
import { StateBlockDrawSettings } from '@/tools/block/state_block_draw_settings.js';

describe('StateBlockDrawSettings', () => {
  it('toggles Block tool active flag and empty-space draw in Select mode', () => {
    const state = new StateBlockDrawSettings();
    let count = 0;
    state.changeListenerAdd(() => {
      count += 1;
    });
    expect(state.blockToolActiveRead()).toBe(false);
    expect(state.emptySpaceDrawInSelectRead()).toBe(true);
    state.blockToolActiveWrite(true);
    state.emptySpaceDrawInSelectWrite(false);
    expect(state.blockToolActiveRead()).toBe(true);
    expect(state.emptySpaceDrawInSelectRead()).toBe(false);
    expect(count).toBe(2);
  });
});
