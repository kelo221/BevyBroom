import { describe, expect, it, vi } from 'vitest';
import { InputVector } from '@/ui/input/input_vector.js';

/** The vector fields share or mix each component on its own and commit by index. */
describe('InputVector', () => {
  it('creates one field per component and shares each component separately', () => {
    const input = new InputVector(3, 'Offset');
    const fields = input.getElement().querySelectorAll('input');
    expect(fields).toHaveLength(3);
    input.setSharedValues(
      [
        [1, 2, 3],
        [1, 5, 3],
      ],
      1,
    );
    expect(input.componentParse(0)).toBe(1);
    expect(input.componentParse(1)).toBeNull();
    expect(input.componentParse(2)).toBe(3);
  });

  it('reports the index of the committed component', () => {
    const input = new InputVector(2, 'Size');
    const commit = vi.fn();
    input.bindCommit(commit);
    const second = input.getElement().querySelectorAll('input')[1];
    if (!second) throw new Error('the second field exists');
    second.value = '4 * 2';
    second.dispatchEvent(new Event('change'));
    expect(commit).toHaveBeenCalledWith(1);
    expect(input.componentParse(1)).toBe(8);
  });
});
