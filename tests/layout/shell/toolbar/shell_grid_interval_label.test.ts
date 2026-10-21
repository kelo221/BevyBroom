import { describe, expect, it } from 'vitest';
import { formatGridIntervalLabel } from '@/layout/shell/toolbar/shell_grid_interval_label.js';
import { SNAP_PRESETS } from '@/types/snap_presets.js';

/** Prefix every grid size label starts with. */
const SHELL_GRID_LABEL_TEST_PREFIX = 'Grid ';

/**
 * Returns the number part of a grid size label.
 *
 * @param label Grid size label.
 * @returns Text after the prefix.
 */
function shellGridLabelTestNumberTextRead(label: string): string {
  return label.slice(SHELL_GRID_LABEL_TEST_PREFIX.length);
}

describe('formatGridIntervalLabel', () => {
  it('prefixes every preset grid size with Grid and keeps its exact value', () => {
    SNAP_PRESETS.forEach((interval) => {
      const label = formatGridIntervalLabel(interval);
      expect(label.startsWith(SHELL_GRID_LABEL_TEST_PREFIX)).toBe(true);
      expect(Number(shellGridLabelTestNumberTextRead(label))).toBe(interval);
    });
  });

  it('shows at least one decimal so whole sizes read as lengths', () => {
    SNAP_PRESETS.forEach((interval) => {
      expect(shellGridLabelTestNumberTextRead(formatGridIntervalLabel(interval))).toMatch(/^\d+\.\d+$/);
    });
    expect(formatGridIntervalLabel(1)).toBe('Grid 1.0');
  });

  it('trims trailing zeros beyond the first decimal', () => {
    expect(formatGridIntervalLabel(0.25)).toBe('Grid 0.25');
    expect(formatGridIntervalLabel(0.5)).toBe('Grid 0.5');
  });

  it('gives every preset a distinct label', () => {
    const labels = SNAP_PRESETS.map((interval) => formatGridIntervalLabel(interval));
    expect(new Set(labels).size).toBe(SNAP_PRESETS.length);
  });
});
