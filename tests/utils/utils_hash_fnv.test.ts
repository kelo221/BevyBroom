import { describe, expect, it } from 'vitest';
import { hashFnv1a32, hashFnv1a32Hex } from '@/utils/utils_hash_fnv.js';

/** FNV-1a hashes are stable, unsigned and written as eight hex digits. */
describe('hashFnv1a32', () => {
  it('matches the published FNV-1a 32-bit values', () => {
    expect(hashFnv1a32('')).toBe(0x811c9dc5);
    expect(hashFnv1a32('a')).toBe(0xe40c292c);
    expect(hashFnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('writes eight lowercase hex digits that follow the number', () => {
    for (const text of ['', 'a', 'shelf', '{"count_x":3}']) {
      const hex = hashFnv1a32Hex(text);
      expect(hex).toMatch(/^[0-9a-f]{8}$/);
      expect(parseInt(hex, 16)).toBe(hashFnv1a32(text));
    }
  });

  it('gives different texts different hashes', () => {
    expect(hashFnv1a32Hex('count 2')).not.toBe(hashFnv1a32Hex('count 3'));
  });
});
