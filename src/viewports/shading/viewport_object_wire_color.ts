import { Theme } from '@/theme.js';

/** FNV-1a 32-bit offset basis. */
const FNV_OFFSET_BASIS = 0x811c9dc5;

/** FNV-1a 32-bit prime. */
const FNV_PRIME = 0x01000193;

/**
 * Stable per-object wireframe colors of the 2D views: every object id maps to
 * one entry of the theme wire palette, so an object keeps its color across
 * sessions while neighbours usually differ.
 */
export class ViewportObjectWireColor {
  /**
   * Hashes an id string with 32-bit FNV-1a.
   *
   * @param id Object id, for example a uuid.
   * @returns Unsigned 32-bit hash.
   */
  static idHash(id: string): number {
    let hash = FNV_OFFSET_BASIS;
    for (let index = 0; index < id.length; index += 1) {
      hash ^= id.charCodeAt(index);
      hash = Math.imul(hash, FNV_PRIME);
    }
    return hash >>> 0;
  }

  /**
   * Returns the palette slot an id maps to.
   *
   * @param id Object id.
   * @returns Index into the theme wire palette.
   */
  static paletteIndexFromId(id: string): number {
    return ViewportObjectWireColor.idHash(id) % Theme.objectWirePalette.length;
  }

  /**
   * Returns the palette color at a slot.
   *
   * @param paletteIndex Index into the theme wire palette.
   * @returns Hex color.
   */
  static colorFromPaletteIndex(paletteIndex: number): number {
    return Theme.objectWirePalette[paletteIndex] ?? Theme.boxEdgeColor;
  }

  /**
   * Returns the stable unselected wire color of an object id.
   *
   * @param id Object id.
   * @returns Hex color from the theme wire palette.
   */
  static colorFromId(id: string): number {
    return ViewportObjectWireColor.colorFromPaletteIndex(ViewportObjectWireColor.paletteIndexFromId(id));
  }

  /**
   * Returns the 2D wire color of an object: the selection color while it is
   * selected, otherwise its stable palette color.
   *
   * @param id Object id.
   * @param isSelected True while the object is selected.
   * @returns Hex color.
   */
  static colorResolve(id: string, isSelected: boolean): number {
    return isSelected ? Theme.selectionColor : ViewportObjectWireColor.colorFromId(id);
  }
}
