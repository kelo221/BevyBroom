import { describe, expect, it } from 'vitest';
import { modifierStackRegrouped } from '@/modifier/stack/evaluate/modifier_stack_structure.js';

describe('derived structure', () => {
  it('counts only kept brushes that changed groups', () => {
    const before = new Map([
      ['a', ''],
      ['b', ''],
    ]);
    expect(modifierStackRegrouped(before, new Map([['a', '']]))).toBe(false);
    expect(modifierStackRegrouped(before, new Map([...before, ['c', '2']]))).toBe(false);
    expect(modifierStackRegrouped(before, new Map([['a', '2']]))).toBe(true);
  });
});
