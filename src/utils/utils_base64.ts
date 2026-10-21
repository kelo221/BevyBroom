/**
 * Bytes converted per String.fromCharCode call, small enough for any argument
 * limit.
 */
const BASE64_ENCODE_CHUNK_BYTES = 0x8000;

/**
 * Decodes base64 text into bytes.
 *
 * @param base64 Base64 text without a data URL prefix.
 * @returns Decoded bytes.
 */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * Encodes bytes as base64 text.
 *
 * @param buffer Bytes to encode.
 * @returns Base64 text.
 */
export function bytesToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += BASE64_ENCODE_CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, offset + BASE64_ENCODE_CHUNK_BYTES);
    chunks.push(String.fromCharCode(...chunk));
  }
  return btoa(chunks.join(''));
}
