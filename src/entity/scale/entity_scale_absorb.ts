import type * as THREE from 'three';
import type { EntityOwner } from '@/entity/model/entity_owner.js';
import { EntityOwnerRegistry } from '@/entity/registry/entity_owner_registry.js';

/** Smallest scale component treated as a real size when converting to a factor. */
const ENTITY_SCALE_MIN_COMPONENT = 1e-6;

/** Largest difference from one that still counts as a unit scale. */
const ENTITY_SCALE_UNIT_TOLERANCE = 1e-9;

/**
 * Returns the uniform factor a possibly non-uniform scale stands for: the
 * component that differs most from one, so a drag along a single axis counts
 * fully. Mirrored components count by their size.
 *
 * @param scale Object scale.
 * @returns Positive uniform factor.
 */
export function entityScaleFactorUniform(scale: THREE.Vector3): number {
  const components = [scale.x, scale.y, scale.z].map((value) => Math.max(Math.abs(value), ENTITY_SCALE_MIN_COMPONENT));
  return components.reduce((best, value) => (Math.abs(Math.log(value)) > Math.abs(Math.log(best)) ? value : best), 1);
}

/**
 * Returns the owner helper of an object whose kind turns scale edits into
 * settings.
 *
 * @param object Candidate object.
 * @returns Owner helper, or null when the object keeps real scale.
 */
export function entityScaleAbsorberFind(object: THREE.Object3D): EntityOwner<object> | null {
  const entityOwner = EntityOwnerRegistry.find(object);
  return entityOwner?.definition.scaleAbsorbs() ? entityOwner : null;
}

/**
 * Returns whether every object turns scale edits into settings.
 *
 * @param objects Candidate objects.
 * @returns True for a non-empty list of absorbing owners only.
 */
export function entityScaleAbsorbsAll(objects: readonly THREE.Object3D[]): boolean {
  return objects.length > 0 && objects.every((object) => entityScaleAbsorberFind(object) !== null);
}

/**
 * Returns whether an object's scale is one on every axis.
 *
 * @param object Candidate object.
 * @returns True for a unit scale.
 */
export function entityScaleIsUnit(object: THREE.Object3D): boolean {
  const { x, y, z } = object.scale;
  return [x, y, z].every((value) => Math.abs(value - 1) <= ENTITY_SCALE_UNIT_TOLERANCE);
}

/**
 * Returns the settings an absorbing owner shows for its current scale, as if
 * the scale had already been turned into settings.
 *
 * @param object Candidate entity owner.
 * @returns Sanitized settings, or null when the object does not absorb scale.
 */
export function entityScaleAbsorbedSettingsRead(object: THREE.Object3D): object | null {
  const entityOwner = entityScaleAbsorberFind(object);
  return entityOwner ? entityScaleSettingsShown(entityOwner, object) : null;
}

/**
 * Returns the settings an owner shows: for kinds that absorb scale, the
 * settings with the current scale turned into them; otherwise the stored
 * settings.
 *
 * @param entityOwner Owner helper of the object's kind.
 * @param object Entity owner.
 * @returns Sanitized settings, or null when the object is not of that kind.
 */
export function entityScaleSettingsShown<TSettings extends object>(
  entityOwner: EntityOwner<TSettings>,
  object: THREE.Object3D,
): TSettings | null {
  const settings = entityOwner.settingsRead(object);
  const definition = entityOwner.definition;
  if (settings === null || !definition.scaleAbsorbs() || entityScaleIsUnit(object)) {
    return settings;
  }
  return definition.settingsSanitize(definition.scaleAbsorb(settings, entityScaleFactorUniform(object.scale)));
}

/**
 * Resets the scale of an absorbing owner to one without changing its settings.
 * Other objects are left alone.
 *
 * @param object Candidate entity owner.
 */
export function entityScaleUnitEnsure(object: THREE.Object3D): void {
  if (entityScaleAbsorberFind(object) !== null) {
    object.scale.set(1, 1, 1);
  }
}
