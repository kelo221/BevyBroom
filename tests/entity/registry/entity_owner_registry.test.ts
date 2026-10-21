import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EntityDefinition } from '@/entity/model/entity_definition.js';
import { EntityOwner } from '@/entity/model/entity_owner.js';
import { ENTITY_KIND_USERDATA_KEY, entityKindRead, entityOwnerIs } from '@/entity/model/entity_owner_keys.js';
import { EntityOwnerRegistry } from '@/entity/registry/entity_owner_registry.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** Settings of the test entity kind. */
interface TestBeaconSettings {
  strength: number;
}

/** Test entity kind with one numeric setting and no visuals. */
class TestBeaconDefinition extends EntityDefinition<TestBeaconSettings> {
  readonly kind: string;

  /**
   * Creates the definition.
   *
   * @param kind Unique kind name for this test.
   */
  constructor(kind: string) {
    super();
    this.kind = kind;
  }

  /**
   * Returns default settings.
   *
   * @returns Default settings.
   */
  settingsCreateDefault(): TestBeaconSettings {
    return { strength: 1 };
  }

  /**
   * Returns the settings unchanged.
   *
   * @param settings Settings.
   * @returns Same settings.
   */
  settingsSanitize(settings: TestBeaconSettings): TestBeaconSettings {
    return settings;
  }

  /**
   * Reads settings from any object value.
   *
   * @param value Any value.
   * @returns Settings, or null for non-objects.
   */
  settingsFromUnknown(value: unknown): TestBeaconSettings | null {
    return typeof value === 'object' && value !== null
      ? { strength: Number((value as TestBeaconSettings).strength) }
      : null;
  }

  /** Draws nothing. */
  visualsRefresh(): void {}

  /**
   * Returns the crosshairs icon.
   *
   * @returns Icon name.
   */
  iconName(): IconName {
    return 'crosshairs';
  }
}

/**
 * The entity owner registry finds the kinds the editor ships with and kinds
 * registered at runtime, and objects of unknown kinds are not entity owners.
 */
describe('EntityOwnerRegistry', () => {
  it('finds the built-in light, room and portal owners by kind and by object', () => {
    expect(EntityOwnerRegistry.findByKind('light')).toBe(LightOwner);
    expect(EntityOwnerRegistry.findByKind('room')).toBe(RoomOwner);
    expect(EntityOwnerRegistry.findByKind('portal')).toBe(PortalOwner);
    expect(EntityOwnerRegistry.find(RoomOwner.createDefault('Room'))).toBe(RoomOwner);
  });

  it('finds a kind registered at runtime and recognizes its owners', () => {
    const kind = `test_beacon_${THREE.MathUtils.generateUUID()}`;
    const beaconOwner = new EntityOwner(new TestBeaconDefinition(kind));
    EntityOwnerRegistry.register(beaconOwner);
    const beacon = beaconOwner.create('Beacon', { strength: 3 });
    expect(entityKindRead(beacon)).toBe(kind);
    expect(EntityOwnerRegistry.find(beacon)).toBe(beaconOwner);
    expect(EntityOwnerRegistry.findByKind(kind)?.settingsRead(beacon)).toEqual({ strength: 3 });
  });

  it('keeps the first owner of a kind when another owner of that kind registers', () => {
    const kind = `test_beacon_${THREE.MathUtils.generateUUID()}`;
    const firstOwner = new EntityOwner(new TestBeaconDefinition(kind));
    const secondOwner = new EntityOwner(new TestBeaconDefinition(kind));
    EntityOwnerRegistry.register(firstOwner);
    EntityOwnerRegistry.register(secondOwner);
    expect(EntityOwnerRegistry.findByKind(kind)).toBe(firstOwner);
  });

  it('does not treat objects stamped with an unknown kind as entity owners', () => {
    const stranger = new THREE.Group();
    stranger.userData[ENTITY_KIND_USERDATA_KEY] = `never_registered_${THREE.MathUtils.generateUUID()}`;
    expect(entityOwnerIs(stranger)).toBe(false);
    expect(EntityOwnerRegistry.find(stranger)).toBeNull();
  });
});
