import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gameEntityClassListFromUnknown } from '@/game_entity/class/game_entity_class_schema.js';
import { gameEntityVariantLightFromUnknown } from '@/game_entity/class/game_entity_class_variant_light.js';

/** Directory of the wire fixtures both sides parse. */
const FIXTURE_BRIDGE_DIRECTORY = resolve(process.cwd(), 'bevy/fixtures');

/** A fogged tube as a class file writes it. */
const TUBE_SOURCE = {
  kind: 'tube',
  from: [-0.5, 0, 0.04],
  to: [0.5, 0, 0.04],
  color: [0.88, 0.96, 1],
  intensity: 0.4,
  radius: 9,
  effect: 'fluorescent_starter',
  fog: { intensity: 0.04, thickness: 1, visibility_m: 2, below_floor_m: 0.5 },
};

/** Variants may declare the light an entity holding them carries. */
describe('gameEntityVariantLightFromUnknown', () => {
  it('keeps a well formed tube with its effect and fog', () => {
    expect(gameEntityVariantLightFromUnknown(TUBE_SOURCE)).toEqual(TUBE_SOURCE);
  });

  it('keeps a point at its place and drops a malformed fog', () => {
    const point = { kind: 'point', at: [0, 1, 0], color: [1, 1, 1], intensity: 1, radius: 3, fog: { intensity: 1 } };
    const light = gameEntityVariantLightFromUnknown(point);
    expect(light?.at).toEqual(point.at);
    expect(light === null ? [] : Object.keys(light)).not.toContain('fog');
  });

  it('refuses lights without the positions of their kind, an unknown kind or a range that is not above zero', () => {
    expect(gameEntityVariantLightFromUnknown({ ...TUBE_SOURCE, to: undefined })).toBeNull();
    expect(gameEntityVariantLightFromUnknown({ ...TUBE_SOURCE, kind: 'point' })).toBeNull();
    expect(gameEntityVariantLightFromUnknown({ ...TUBE_SOURCE, kind: 'laser' })).toBeNull();
    expect(gameEntityVariantLightFromUnknown({ ...TUBE_SOURCE, radius: 0 })).toBeNull();
    expect(gameEntityVariantLightFromUnknown({ ...TUBE_SOURCE, intensity: -1 })).toBeNull();
    expect(gameEntityVariantLightFromUnknown('tube')).toBeNull();
  });

  it('keeps the variant light of the shared bridge fixture', () => {
    const raw = JSON.parse(
      readFileSync(resolve(FIXTURE_BRIDGE_DIRECTORY, 'placeable_classes_sample.json'), 'utf8'),
    ) as {
      classes: Array<{ fields?: Array<{ variant_details?: Record<string, { light?: unknown }> }> }>;
    };
    const rawLight = raw.classes
      .flatMap((entry) => entry.fields ?? [])
      .flatMap((field) => Object.values(field.variant_details ?? {}))
      .find((detail) => detail.light !== undefined)?.light;
    const parsedLight = gameEntityClassListFromUnknown(raw)
      ?.classes.flatMap((entry) => entry.fields)
      .flatMap((field) => Object.values(field.variant_details ?? {}))
      .find((detail) => detail.light !== undefined)?.light;
    expect(rawLight).toBeDefined();
    expect(parsedLight).toEqual(rawLight);
  });
});
