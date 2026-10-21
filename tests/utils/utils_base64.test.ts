import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from '@/utils/utils_base64.js';

/**
 * Base64 helpers carry binary files such as GLB geometry and textures through
 * JSON.
 */
describe('base64 helpers', () => {
  it('round-trips every byte value', () => {
    const bytes = new Uint8Array(256).map((_, index) => index);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it('encodes buffers larger than one conversion chunk', () => {
    const bytes = new Uint8Array(100_000).map((_, index) => (index * 31) % 256);
    const decoded = base64ToBytes(bytesToBase64(bytes.buffer));
    expect(decoded.length).toBe(bytes.length);
    expect(decoded[99_999]).toBe(bytes[99_999]);
  });

  it('matches the standard encoding', () => {
    expect(bytesToBase64(new TextEncoder().encode('glTF'))).toBe('Z2xURg==');
  });
});
