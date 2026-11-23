import * as THREE from 'three';
import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';

/**
 * Lightness shifts, in HSL lightness, the bands of variants without their own
 * color take in turn from the class marker color.
 */
const GAME_ENTITY_VOLUME_RUN_LIGHTNESS_SHIFTS: readonly number[] = [0, 0.18, -0.14, 0.32];

/** Lowest and highest lightness a shifted band color may take. */
const GAME_ENTITY_VOLUME_RUN_LIGHTNESS_RANGE = { minimum: 0.12, maximum: 0.88 } as const;

/**
 * Picks the color of each floor band of a volume marker: the variant's own
 * color, or the class marker color made lighter or darker by the band's place.
 */
export class GameEntityVisualVolumeRunColors {
  /**
   * Returns the band color of one run.
   *
   * @param field Runs field naming the variants.
   * @param variantId Variant of the run.
   * @param index Position of the run in the list.
   * @param markerColorHex Class marker color as an sRGB hex number.
   * @returns Band color as an sRGB hex number.
   */
  static runColorOf(field: GameEntityField, variantId: string, index: number, markerColorHex: number): number {
    const ownColor = field.variant_details?.[variantId]?.color;
    if (ownColor !== undefined) {
      return GameEntityVisualVolumeRunColors.srgbHexOf(ownColor);
    }
    return GameEntityVisualVolumeRunColors.shadeOf(markerColorHex, index);
  }

  /**
   * Returns the marker color shifted in lightness for a band position.
   *
   * @param markerColorHex Class marker color as an sRGB hex number.
   * @param index Position of the run in the list.
   * @returns Shifted color as an sRGB hex number.
   */
  static shadeOf(markerColorHex: number, index: number): number {
    const shifts = GAME_ENTITY_VOLUME_RUN_LIGHTNESS_SHIFTS;
    const shift = shifts[index % shifts.length] ?? 0;
    const color = new THREE.Color().setHex(markerColorHex, THREE.SRGBColorSpace);
    const hsl = color.getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
    const range = GAME_ENTITY_VOLUME_RUN_LIGHTNESS_RANGE;
    const lightness = Math.min(range.maximum, Math.max(range.minimum, hsl.l + shift));
    return color.setHSL(hsl.h, hsl.s, lightness, THREE.SRGBColorSpace).getHex(THREE.SRGBColorSpace);
  }

  /**
   * Returns an sRGB color given as channels in zero to one as a hex number.
   *
   * @param channels Red, green and blue in zero to one.
   * @returns SRGB hex number.
   */
  static srgbHexOf(channels: readonly [number, number, number]): number {
    const [red, green, blue] = channels;
    return new THREE.Color().setRGB(red, green, blue, THREE.SRGBColorSpace).getHex(THREE.SRGBColorSpace);
  }
}
