import { describe, expect, it } from 'vitest';
import { IconHammerIdScope } from '@/ui/icons/hammer/core/icon_hammer_id_scope.js';

describe('IconHammerIdScope', () => {
  it('gives the same local name a different id in every scope', () => {
    const first = new IconHammerIdScope('tool_block');
    const second = new IconHammerIdScope('tool_block');
    expect(first.idFor('front')).not.toBe(second.idFor('front'));
  });

  it('keeps ids of different local names apart within one scope', () => {
    const scope = new IconHammerIdScope('tool_block');
    expect(scope.idFor('front')).not.toBe(scope.idFor('top'));
    expect(scope.idFor('front')).toBe(scope.idFor('front'));
  });

  it('wraps the id in a url reference', () => {
    const scope = new IconHammerIdScope('tool_clip');
    expect(scope.urlFor('region')).toBe(`url(#${scope.idFor('region')})`);
  });
});
