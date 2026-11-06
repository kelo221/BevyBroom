import { describe, expect, it } from 'vitest';
import { listItemsIdentical } from '@/utils/utils_list.js';

/** Lists match only when they hold the very same items in the same order. */
describe('listItemsIdentical', () => {
  it('matches the same items in order and rejects other orders, lengths and equal copies', () => {
    const first = { name: 'first' };
    const second = { name: 'second' };
    expect(listItemsIdentical([first, second], [first, second])).toBe(true);
    expect(listItemsIdentical([], [])).toBe(true);
    expect(listItemsIdentical([first, second], [second, first])).toBe(false);
    expect(listItemsIdentical([first], [first, second])).toBe(false);
    expect(listItemsIdentical([first], [{ ...first }])).toBe(false);
  });
});
