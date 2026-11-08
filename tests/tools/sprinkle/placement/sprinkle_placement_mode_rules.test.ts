import { describe, expect, it } from 'vitest';
import { SprinklePlacementModeRules } from '@/tools/sprinkle/placement/sprinkle_placement_mode_rules.js';
import { SPRINKLE_PLACEMENT_MODES } from '@/tools/sprinkle/sprinkle_types.js';

/** Add and remove decisions of every Sprinkle placement mode. */
describe('SprinklePlacementModeRules', () => {
  it('clears the brush only for SUBTRACTIVE and REPLACE', () => {
    const clearing = SPRINKLE_PLACEMENT_MODES.filter((mode) => SprinklePlacementModeRules.brushClearIs(mode));
    expect(clearing).toEqual(['SUBTRACTIVE', 'REPLACE']);
  });

  it('places into free cells in ADDITIVE and REPLACE only', () => {
    const placingFree = SPRINKLE_PLACEMENT_MODES.filter((mode) =>
      SprinklePlacementModeRules.cellPlacementAllowedIs(mode, false),
    );
    expect(placingFree).toEqual(['ADDITIVE', 'REPLACE']);
  });

  it('places into occupied cells in every mode but SUBTRACTIVE', () => {
    const placingOccupied = SPRINKLE_PLACEMENT_MODES.filter((mode) =>
      SprinklePlacementModeRules.cellPlacementAllowedIs(mode, true),
    );
    expect(placingOccupied).toEqual(['ADDITIVE', 'REPLACE', 'OVERWRITE']);
  });

  it('turns every mode into SUBTRACTIVE while Ctrl is held', () => {
    for (const mode of SPRINKLE_PLACEMENT_MODES) {
      expect(SprinklePlacementModeRules.pressModeResolve(mode, true)).toBe('SUBTRACTIVE');
      expect(SprinklePlacementModeRules.pressModeResolve(mode, false)).toBe(mode);
    }
  });
});
