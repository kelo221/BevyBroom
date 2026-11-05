import type { EntityClassPointVariant } from '@/entity/class/entity_class_point_variant.js';
import { type LightKind, type LightSettings, lightSettingsCreateDefault } from '@/light/model/light_settings.js';

/** Category the light classes are listed under. */
const LIGHT_POINT_CLASS_CATEGORY = 'Lights';

/**
 * Builds the point class of one light kind. Changing a light between kinds
 * keeps its color, range and every other setting.
 *
 * @param kind Point or spot.
 * @param label Visible class name.
 * @param helpText Help box text.
 * @returns Point class variant.
 */
function lightPointClassVariantCreate(
  kind: LightKind,
  label: string,
  helpText: string,
): EntityClassPointVariant<LightSettings> {
  return {
    id: `lights.${kind}`,
    label,
    category: LIGHT_POINT_CLASS_CATEGORY,
    helpText,
    settingsCreate: (previous) => (previous ? { ...previous, kind } : lightSettingsCreateDefault(kind)),
    settingsMatch: (settings) => settings.kind === kind,
  };
}

/**
 * Returns the point classes of authored lights.
 *
 * @returns Point light and spot light classes.
 */
export function lightPointClassVariantsCreate(): readonly EntityClassPointVariant<LightSettings>[] {
  return [
    lightPointClassVariantCreate(
      'point',
      'Point Light',
      'A DynLight point light. It shines in every direction up to its radius and is baked unless it is realtime.',
    ),
    lightPointClassVariantCreate(
      'spot',
      'Spot Light',
      'A DynLight spot light. It shines along its forward direction inside its outer cone, up to its radius.',
    ),
  ];
}
