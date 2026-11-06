/** Caption and help of one entity-settings keyvalue. */
export interface ObjectPropertiesKeyvalueEntitySettingCaption {
  readonly label: string;
  readonly helpText: string;
}

/** Light settings captions transcribed from the SmartEdit light groups. */
const LIGHT_SETTING_CAPTIONS: Readonly<Record<string, ObjectPropertiesKeyvalueEntitySettingCaption>> = {
  kind: { label: 'Type', helpText: 'Light type' },
  enabled: { label: 'Enabled', helpText: 'Light enabled' },
  colorHex: { label: 'Color', helpText: 'Light color' },
  intensity: { label: 'Intensity', helpText: 'Light intensity' },
  radius: { label: 'Radius', helpText: 'Light radius' },
  falloff: { label: 'Falloff', helpText: 'Light falloff' },
  innerCutoffDegrees: { label: 'Inner', helpText: 'Spot inner angle' },
  outerCutoffDegrees: { label: 'Outer', helpText: 'Spot outer angle' },
  realtime: { label: 'Realtime', helpText: 'Light realtime' },
  shadows: { label: 'Shadows', helpText: 'Light shadows' },
  effectKind: { label: 'Effect', helpText: 'Light effect' },
  effectPulseSpeed: { label: 'Speed', helpText: 'Light effect speed' },
  effectPulseModifier: { label: 'Min', helpText: 'Light effect minimum' },
  effectPulseOffset: { label: 'Offset', helpText: 'Light effect offset' },
  effectTimestep: { label: 'Step', helpText: 'Light effect step' },
  cookieTexture: { label: 'Texture', helpText: 'Light cookie' },
  fogEnabled: { label: 'Fog', helpText: 'Light fog' },
  fogShape: { label: 'Shape', helpText: 'Light fog shape' },
  fogRadius: { label: 'Radius', helpText: 'Light fog radius' },
  fogThickness: { label: 'Thickness', helpText: 'Light fog thickness' },
  fogIntensity: { label: 'Opacity', helpText: 'Light fog opacity' },
  fogVisibility: { label: 'Clear', helpText: 'Light fog clear distance' },
  shimmer: { label: 'Shimmer', helpText: 'Light shimmer' },
  shimmerScale: { label: 'Scale', helpText: 'Light shimmer scale' },
  shimmerModifier: { label: 'Min', helpText: 'Light shimmer minimum' },
  illumination: { label: 'Bounce', helpText: 'Light illumination' },
  transparency: { label: 'See-thru', helpText: 'Light transparency' },
  bounceColorHex: { label: 'Tint', helpText: 'Light bounce tint' },
  bounceColorAlpha: { label: 'Tint mix', helpText: 'Light bounce tint mix' },
  bounceModifier: { label: 'Visible', helpText: 'Light bounce visibility' },
  bounceIntensity: { label: 'Strength', helpText: 'Light bounce strength' },
  bounceSamples: { label: 'Samples', helpText: 'Light bounce samples' },
  bounceCompression: { label: 'Storage', helpText: 'Light bounce storage' },
};

/** Room settings captions transcribed from the SmartEdit room section. */
const ROOM_SETTING_CAPTIONS: Readonly<Record<string, ObjectPropertiesKeyvalueEntitySettingCaption>> = {
  halfSizeX: { label: 'Half X', helpText: 'Room half size X' },
  halfSizeY: { label: 'Half Y', helpText: 'Room half size Y' },
  halfSizeZ: { label: 'Half Z', helpText: 'Room half size Z' },
};

/** Portal settings captions transcribed from the SmartEdit portal section. */
const PORTAL_SETTING_CAPTIONS: Readonly<Record<string, ObjectPropertiesKeyvalueEntitySettingCaption>> = {
  width: { label: 'Width', helpText: 'Portal width' },
  height: { label: 'Height', helpText: 'Portal height' },
  closed: { label: 'Closed', helpText: 'Portal closed' },
};

/**
 * Returns the human caption and help of one entity-settings key.
 *
 * @param kind Entity kind, such as `light`, `room` or `portal`.
 * @param key Settings field name.
 * @returns Known caption, or the key and generic help when the field is
 *   unknown.
 */
export function objectPropertiesKeyvalueEntitySettingCaptionLookup(
  kind: string,
  key: string,
): ObjectPropertiesKeyvalueEntitySettingCaption {
  const caption = objectPropertiesKeyvalueEntitySettingCaptionTable(kind)[key];
  if (caption) {
    return caption;
  }
  return {
    label: key,
    helpText: `Setting ${key} of the ${kind} kind.`,
  };
}

/**
 * Returns the caption table of one entity kind.
 *
 * @param kind Entity kind.
 * @returns Captions keyed by settings field, or empty when the kind is unknown.
 */
function objectPropertiesKeyvalueEntitySettingCaptionTable(
  kind: string,
): Readonly<Record<string, ObjectPropertiesKeyvalueEntitySettingCaption>> {
  if (kind === 'light') {
    return LIGHT_SETTING_CAPTIONS;
  }
  if (kind === 'room') {
    return ROOM_SETTING_CAPTIONS;
  }
  if (kind === 'portal') {
    return PORTAL_SETTING_CAPTIONS;
  }
  return {};
}
