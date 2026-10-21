import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EntitySelectionFollower } from '@/entity/selection/entity_selection_follower.js';
import { entitySelectedIs, entitySelectedOnlyIs } from '@/entity/selection/entity_selection_state.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { RoomOwner } from '@/portal/model/room_owner.js';

/** A selection whose change callbacks the test triggers. */
class EntitySelectionTestSource {
  private selected: THREE.Object3D[] = [];
  private readonly callbacks: (() => void)[] = [];

  /**
   * Returns the selected objects.
   *
   * @returns Selected objects.
   */
  getSelectedObjects(): Iterable<THREE.Object3D> {
    return this.selected;
  }

  /**
   * Registers a change callback.
   *
   * @param callback Change callback.
   */
  onSelectionChanged(callback: () => void): void {
    this.callbacks.push(callback);
  }

  /**
   * Replaces the selection and runs the change callbacks.
   *
   * @param objects New selection.
   */
  set(objects: THREE.Object3D[]): void {
    this.selected = objects;
    this.callbacks.forEach((callback) => callback());
  }
}

/**
 * Creates a spot light with fog, so it has range, cone and fog guides.
 *
 * @returns Light owner.
 */
function spotWithFogCreate(): THREE.Group {
  return LightOwner.create('Spot', { ...lightSettingsCreateDefault('spot'), fogEnabled: true });
}

/**
 * Returns the names of an owner's parts that are drawn now.
 *
 * @param owner Entity owner.
 * @returns Names of visible selection-only parts.
 */
function guidesShown(owner: THREE.Object3D): string[] {
  return owner.children.filter((child) => entitySelectedOnlyIs(child) && child.visible).map((child) => child.name);
}

/**
 * Returns the names of an owner's selection-only parts.
 *
 * @param owner Entity owner.
 * @returns Names of selection-only parts.
 */
function guidesAll(owner: THREE.Object3D): string[] {
  return owner.children.filter((child) => entitySelectedOnlyIs(child)).map((child) => child.name);
}

/**
 * Returns the marker of a light or fails the test.
 *
 * @param owner Light owner.
 * @returns Marker mesh.
 */
function markerRead(owner: THREE.Object3D): THREE.Mesh {
  const marker = LightOwner.markerOf(owner);
  if (!marker) {
    throw new Error('light has no marker');
  }
  return marker;
}

describe('EntitySelectionFollower', () => {
  it('hides the range, cone and fog of an unselected light', () => {
    const light = spotWithFogCreate();
    expect(guidesAll(light)).toHaveLength(3);
    expect(guidesShown(light)).toEqual([]);
  });

  it('shows the guides of a light while its box is selected and hides them after', () => {
    const selection = new EntitySelectionTestSource();
    new EntitySelectionFollower(selection);
    const light = spotWithFogCreate();
    const other = spotWithFogCreate();
    selection.set([markerRead(light)]);
    expect(entitySelectedIs(light)).toBe(true);
    expect(guidesShown(light)).toEqual(guidesAll(light));
    expect(guidesShown(other)).toEqual([]);
    selection.set([markerRead(other)]);
    expect(guidesShown(light)).toEqual([]);
    expect(guidesShown(other)).toEqual(guidesAll(other));
  });

  it('keeps the guides of a selected light shown when its settings rebuild them', () => {
    const selection = new EntitySelectionTestSource();
    new EntitySelectionFollower(selection);
    const light = spotWithFogCreate();
    selection.set([light]);
    const settings = LightOwner.settingsRead(light) ?? lightSettingsCreateDefault('spot');
    LightOwner.settingsWrite(light, { ...settings, radius: settings.radius * 2 });
    expect(guidesShown(light)).toEqual(guidesAll(light));
    expect(guidesAll(light)).toHaveLength(3);
  });

  it('leaves the outline of a room drawn whether or not it is selected', () => {
    const room = RoomOwner.createDefault('Room');
    const outlines = room.children.filter((child) => child instanceof THREE.LineSegments && child.visible);
    expect(outlines.length).toBeGreaterThan(0);
    expect(guidesAll(room)).toEqual([]);
  });
});
