/** FNV-1a 32-bit offset basis. */
const HASH_FNV_OFFSET_BASIS = 0x811c9dc5;

/** FNV-1a 32-bit prime. */
const HASH_FNV_PRIME = 0x01000193;

/**
 * Hashes a string with 32-bit FNV-1a: fast, stable across sessions and
 * platforms, not meant for security.
 *
 * @param text String to hash, read as UTF-16 code units.
 * @returns Unsigned 32-bit hash.
 */
export function hashFnv1a32(text: string): number {
  let hash = HASH_FNV_OFFSET_BASIS;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, HASH_FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * Hashes a string with 32-bit FNV-1a and writes the hash as eight hex digits.
 *
 * @param text String to hash.
 * @returns Lowercase hex hash, zero padded.
 */
export function hashFnv1a32Hex(text: string): string {
  return hashFnv1a32(text).toString(16).padStart(8, '0');
}
