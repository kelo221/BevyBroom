import { describe, expect, it, vi } from 'vitest';
import { SelectionFilterMode } from '@/types/selection_filter_mode.js';
import { StateSelectionFilter } from '@/selection/filter/state_selection_filter.js';

describe('StateSelectionFilter', () => {
  it('defaults to Objects mode with Ignore Groups disabled', () => {
    const state = new StateSelectionFilter();
    expect(state.modeRead()).toBe(SelectionFilterMode.OBJECTS);
    expect(state.ignoreGroupsRead()).toBe(false);
    expect(state.effectiveModeRead()).toBe(SelectionFilterMode.OBJECTS);
  });

  it('notifies listeners when mode or ignoreGroups changes and downgrades Groups when ignoreGroups is on', () => {
    const state = new StateSelectionFilter();
    const listener = vi.fn();
    const unsubscribe = state.changeListenerAdd(listener);

    state.modeWrite(SelectionFilterMode.GROUPS);
    expect(state.effectiveModeRead()).toBe(SelectionFilterMode.GROUPS);
    expect(listener).toHaveBeenCalledTimes(1);

    state.ignoreGroupsWrite(true);
    expect(state.effectiveModeRead()).toBe(SelectionFilterMode.OBJECTS);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    state.modeWrite(SelectionFilterMode.SOLIDS);
    expect(state.effectiveModeRead()).toBe(SelectionFilterMode.SOLIDS);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
