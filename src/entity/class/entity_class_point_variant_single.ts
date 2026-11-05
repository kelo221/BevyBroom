import type { EntityClassPointVariant } from '@/entity/class/entity_class_point_variant.js';

/** What the only point class of an entity kind is called and how it starts. */
export interface EntityClassPointVariantSingleOptions<TSettings extends object> {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly helpText: string;
  /** Returns the settings of a new owner. */
  readonly settingsCreateDefault: () => TSettings;
}

/**
 * Builds the point class of a kind that has exactly one: every owner of the
 * kind is of the class, and an owner that already is keeps its settings.
 *
 * @param options Names, help text and default settings of the class.
 * @returns Point class variant.
 */
export function entityClassPointVariantSingleCreate<TSettings extends object>(
  options: EntityClassPointVariantSingleOptions<TSettings>,
): EntityClassPointVariant<TSettings> {
  return {
    id: options.id,
    label: options.label,
    category: options.category,
    helpText: options.helpText,
    settingsCreate: (previous) => previous ?? options.settingsCreateDefault(),
    settingsMatch: () => true,
  };
}
