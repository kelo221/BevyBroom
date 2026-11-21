import * as THREE from 'three';
import type {
  GameEntityVariantLight,
  GameEntityVariantLightFog,
} from '@/game_entity/class/game_entity_class_variant_light.js';
import { GameEntityFixtureLightFloorProbe } from '@/game_entity/fixture_light/game_entity_fixture_light_floor_probe.js';
import { GameEntityFixtureLightMark } from '@/game_entity/fixture_light/game_entity_fixture_light_mark.js';
import type { GameEntityFixtureLightSpec } from '@/game_entity/fixture_light/game_entity_fixture_light_spec.js';
import { LIGHT_EFFECT_KINDS, type LightSettingsEffect } from '@/light/model/features/light_settings_effect.js';
import type { LightSettingsFog } from '@/light/model/features/light_settings_fog.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { type LightSettings, lightSettingsCreateDefault, lightSettingsSanitize } from '@/light/model/light_settings.js';

/** Smallest fog reach written, in meters. */
const GAME_ENTITY_FIXTURE_FOG_MIN_RADIUS = 0.1;

/** Axis a tube light runs along in its own space; never modified. */
const GAME_ENTITY_FIXTURE_TUBE_AXIS = new THREE.Vector3(1, 0, 0);

/** Down in the entity's space; never modified. */
const GAME_ENTITY_FIXTURE_DOWN = new THREE.Vector3(0, -1, 0);

/** Squared length below which down runs along the tube, so no roll is chosen. */
const GAME_ENTITY_FIXTURE_VERTICAL_TUBE_EPSILON = 1e-10;

/** Where a fixture light sits in its entity's space and how it is turned. */
interface GameEntityFixtureLightPlacement {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly tubeLength: number;
}

/**
 * Builds the light an entity's variant declares as a light owner placed in the
 * entity's own space: a tube centred between its ends with its local X axis
 * running from one end to the other and its local −Z axis rolled downward, or a
 * point at its place.
 */
export class GameEntityFixtureLightBuilder {
  /**
   * Creates the light of a variant for an entity that already sits in the
   * scene.
   *
   * @param owner Entity the light belongs to, attached to the scene.
   * @param spec Light the entity's variant asks for.
   * @param worldObject Scene root, searched for the floor under the light.
   * @returns Detached light owner, marked as made from the variant.
   */
  static lightCreate(
    owner: THREE.Object3D,
    spec: GameEntityFixtureLightSpec,
    worldObject: THREE.Object3D,
  ): THREE.Group {
    const placement = GameEntityFixtureLightBuilder.placementOf(spec.light);
    const worldPosition = owner.localToWorld(placement.position.clone());
    const settings = GameEntityFixtureLightBuilder.settingsOf(spec.light, placement.tubeLength);
    if (spec.light.fog !== undefined) {
      const height = GameEntityFixtureLightFloorProbe.heightAboveFloor(worldObject, worldPosition);
      Object.assign(settings, GameEntityFixtureLightBuilder.fogOf(spec.light.fog, height));
    }
    const light = LightOwner.create(`${owner.name} light`, lightSettingsSanitize(settings));
    light.position.copy(placement.position);
    light.quaternion.copy(placement.quaternion);
    GameEntityFixtureLightMark.write(light, spec.variantKey);
    return light;
  }

  /**
   * Returns where a variant's light sits and how it is turned.
   *
   * @param light Light the variant declares.
   * @returns The midpoint and turn of a tube with its length, or the place of a
   *   point without a turn.
   */
  private static placementOf(light: GameEntityVariantLight): GameEntityFixtureLightPlacement {
    if (light.kind === 'point' || light.from === undefined || light.to === undefined) {
      const position = new THREE.Vector3(...(light.at ?? [0, 0, 0]));
      return { position, quaternion: new THREE.Quaternion(), tubeLength: 0 };
    }
    const from = new THREE.Vector3(...light.from);
    const to = new THREE.Vector3(...light.to);
    const direction = to.clone().sub(from);
    const quaternion = GameEntityFixtureLightBuilder.tubeTurnOf(direction.clone().normalize());
    return { position: from.clone().add(to).multiplyScalar(0.5), quaternion, tubeLength: direction.length() };
  }

  /**
   * Returns the turn of a tube: its local X axis along the tube and, rolled
   * about it, its local −Z axis pointing as far down as the tube allows, so a
   * fog frustum along −Z hangs towards the floor.
   *
   * @param tubeDirection Unit direction from one end to the other.
   * @returns Turn of the tube light.
   */
  private static tubeTurnOf(tubeDirection: THREE.Vector3): THREE.Quaternion {
    const down = GAME_ENTITY_FIXTURE_DOWN.clone().projectOnPlane(tubeDirection);
    if (down.lengthSq() < GAME_ENTITY_FIXTURE_VERTICAL_TUBE_EPSILON) {
      return new THREE.Quaternion().setFromUnitVectors(GAME_ENTITY_FIXTURE_TUBE_AXIS, tubeDirection);
    }
    const localZ = down.normalize().negate();
    const localY = localZ.clone().cross(tubeDirection);
    const basis = new THREE.Matrix4().makeBasis(tubeDirection, localY, localZ);
    return new THREE.Quaternion().setFromRotationMatrix(basis);
  }

  /**
   * Returns the light settings of a variant's light without its fog.
   *
   * @param light Light the variant declares.
   * @param tubeLength Length of a tube, ignored for points.
   * @returns Settings of a realtime light in the variant's color, not yet
   *   validated.
   */
  private static settingsOf(light: GameEntityVariantLight, tubeLength: number): LightSettings {
    const kind = light.kind === 'tube' ? 'tube' : 'point';
    return {
      ...lightSettingsCreateDefault(kind),
      colorHex: GameEntityFixtureLightBuilder.colorHexOfLinear(light.color),
      intensity: light.intensity,
      radius: light.radius,
      realtime: true,
      tubeLength: kind === 'tube' ? tubeLength : lightSettingsCreateDefault(kind).tubeLength,
      ...GameEntityFixtureLightBuilder.effectOf(light.effect),
    };
  }

  /**
   * Returns the effect fields of an effect name.
   *
   * @param effect DynLight effect kind in snake case, or undefined.
   * @returns The effect kind when the editor knows it, otherwise nothing.
   */
  private static effectOf(effect: string | undefined): Partial<LightSettingsEffect> {
    const effectKind = LIGHT_EFFECT_KINDS.find((kind) => kind === effect);
    return effectKind === undefined ? {} : { effectKind };
  }

  /**
   * Returns the fog fields of a variant's fog: a frustum reaching from the
   * light down to the floor and the fog's extra depth below it.
   *
   * @param fog Fog the variant declares.
   * @param heightAboveFloor Meters from the light down to the floor.
   * @returns Fog settings.
   */
  private static fogOf(fog: GameEntityVariantLightFog, heightAboveFloor: number): LightSettingsFog {
    return {
      fogEnabled: true,
      fogShape: 'frustum',
      fogRadius: Math.max(GAME_ENTITY_FIXTURE_FOG_MIN_RADIUS, heightAboveFloor + fog.below_floor_m),
      fogThickness: fog.thickness,
      fogIntensity: fog.intensity,
      fogVisibility: fog.visibility_m,
    };
  }

  /**
   * Converts a linear color into the sRGB hex number lights store.
   *
   * @param color Linear red, green and blue, 0 to 1.
   * @returns SRGB color as 0xRRGGBB.
   */
  private static colorHexOfLinear(color: readonly [number, number, number]): number {
    return new THREE.Color().setRGB(...color, THREE.LinearSRGBColorSpace).getHex(THREE.SRGBColorSpace);
  }
}
