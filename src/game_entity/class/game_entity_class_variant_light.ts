import {
  gameEntityRecordIs,
  gameEntityTextIsFilled,
  gameEntityVector3Read,
} from '@/game_entity/class/game_entity_class_schema.js';
import type {
  PreviewPlaceableVariantLight,
  PreviewPlaceableVariantLightFog,
} from '@/preview/protocol/preview_protocol_placeable_types.js';

/** Light an entity holding an enum variant carries. */
export type GameEntityVariantLight = PreviewPlaceableVariantLight;

/** Fog hanging from a variant's light down to the floor. */
export type GameEntityVariantLightFog = PreviewPlaceableVariantLightFog;

/**
 * Reads the untrusted light of an enum variant.
 *
 * @param value Any value.
 * @returns Valid light, or null when it is missing, names an unknown kind,
 *   lacks the positions of its kind or has a color, intensity or radius that is
 *   not finite.
 */
export function gameEntityVariantLightFromUnknown(value: unknown): GameEntityVariantLight | null {
  if (!gameEntityRecordIs(value)) {
    return null;
  }
  const look = gameEntityVariantLightLookRead(value);
  const placement = gameEntityVariantLightPlacementRead(value);
  if (look === null || placement === null) {
    return null;
  }
  const light: GameEntityVariantLight = { ...placement, ...look };
  if (gameEntityTextIsFilled(value['effect'])) {
    light.effect = value['effect'];
  }
  const fog = gameEntityVariantLightFogRead(value['fog']);
  if (fog !== null) {
    light.fog = fog;
  }
  return light;
}

/**
 * Reads the kind and positions of a variant light.
 *
 * @param value Untrusted light record.
 * @returns Kind with the ends of a tube or the place of a point, or null when
 *   the kind is unknown or its positions are missing.
 */
function gameEntityVariantLightPlacementRead(
  value: Record<string, unknown>,
): Pick<GameEntityVariantLight, 'kind' | 'from' | 'to' | 'at'> | null {
  if (value['kind'] === 'tube') {
    const from = gameEntityVector3Read(value['from']);
    const to = gameEntityVector3Read(value['to']);
    return from === null || to === null ? null : { kind: 'tube', from, to };
  }
  if (value['kind'] === 'point') {
    const at = gameEntityVector3Read(value['at']);
    return at === null ? null : { kind: 'point', at };
  }
  return null;
}

/**
 * Reads the color, intensity and radius of a variant light.
 *
 * @param value Untrusted light record.
 * @returns The three, or null when one is missing or not finite, the intensity
 *   is negative or the radius is not above zero.
 */
function gameEntityVariantLightLookRead(
  value: Record<string, unknown>,
): Pick<GameEntityVariantLight, 'color' | 'intensity' | 'radius'> | null {
  const color = gameEntityVector3Read(value['color']);
  const intensity = value['intensity'];
  const radius = value['radius'];
  if (color === null || !gameEntityVariantLightNumberIs(intensity) || !gameEntityVariantLightNumberIs(radius)) {
    return null;
  }
  return intensity < 0 || radius <= 0 ? null : { color, intensity, radius };
}

/**
 * Reads the untrusted fog of a variant light.
 *
 * @param value Any value.
 * @returns Fog with its four finite numbers, or null when one is missing.
 */
function gameEntityVariantLightFogRead(value: unknown): GameEntityVariantLightFog | null {
  if (!gameEntityRecordIs(value)) {
    return null;
  }
  const { intensity, thickness, visibility_m: visibility, below_floor_m: belowFloor } = value;
  const numbers = [intensity, thickness, visibility, belowFloor];
  if (!numbers.every(gameEntityVariantLightNumberIs)) {
    return null;
  }
  return {
    intensity: intensity as number,
    thickness: thickness as number,
    visibility_m: visibility as number,
    below_floor_m: belowFloor as number,
  };
}

/**
 * Returns whether a value is a finite number.
 *
 * @param value Any value.
 * @returns True for finite numbers.
 */
function gameEntityVariantLightNumberIs(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
