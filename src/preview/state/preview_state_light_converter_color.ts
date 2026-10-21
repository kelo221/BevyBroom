/**
 * Splits a 0xRRGGBB color into sRGB channels from 0 to 1.
 *
 * @param colorHex Color number.
 * @returns Red, green and blue channels.
 */
export function previewLightColorChannels(colorHex: number): [number, number, number] {
  const red = (colorHex >> 16) & 0xff;
  const green = (colorHex >> 8) & 0xff;
  const blue = colorHex & 0xff;
  return [red / 255, green / 255, blue / 255];
}
