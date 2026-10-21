import type { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import { previewE2eEntityRowsQuery } from './preview_e2e_game_query.js';

/** Type path of the sample game's door component. */
export const PREVIEW_E2E_DOOR_COMPONENT = 'broom_preview::placeables::Door';

/** Type path of the sample game's spinner component. */
export const PREVIEW_E2E_SPINNER_COMPONENT = 'broom_preview::placeables::Spinner';

/** Type path of the sample game's door stats data asset. */
export const PREVIEW_E2E_DOOR_STATS_ASSET = 'broom_preview::placeables::DoorStats';

/** Type path of the sample game's component mirroring a door's stats. */
export const PREVIEW_E2E_DOOR_STATS_MIRROR_COMPONENT = 'broom_preview::placeables::DoorStatsMirror';

/** Type path of the bridge's free-form properties component. */
export const PREVIEW_E2E_PROPERTIES_COMPONENT = 'broom_bridge::placeables::properties::BroomProperties';

/** Type path of the bridge's game entity marker. */
export const PREVIEW_E2E_GAME_ENTITY_COMPONENT = 'broom_bridge::placeables::points::AuthoredGameEntity';

/** Type path of the bridge's exported node marker. */
export const PREVIEW_E2E_AUTHORED_NODE_COMPONENT = 'broom_bridge::authoring::nodes::AuthoredNode';

/**
 * Reads the editor id of a game entity marker or an exported node marker as
 * Bevy's remote protocol serializes it.
 *
 * @param marker Serialized marker component.
 * @returns Editor id, or null when the shape is not recognized.
 */
function previewE2eMarkerIdRead(marker: unknown): string | null {
  if (typeof marker === 'string') {
    return marker;
  }
  if (Array.isArray(marker) && typeof marker[0] === 'string') {
    return marker[0];
  }
  const id = (marker as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : null;
}

/**
 * Reads one component of the game entity that shows an editor object.
 *
 * @param transport Transport to the game's bridge.
 * @param marker Marker component type path: the game entity or exported node
 *   marker.
 * @param objectId Editor object id.
 * @param component Component type path to read.
 * @returns The serialized component, or null when the object does not have it.
 */
export async function previewE2eObjectComponentRead(
  transport: PreviewLinkTransport,
  marker: string,
  objectId: string,
  component: string,
): Promise<Record<string, unknown> | null> {
  const rows = await previewE2eEntityRowsQuery(transport, [marker, component]);
  const row = rows.find((candidate) => previewE2eMarkerIdRead(candidate.components[marker]) === objectId);
  return (row?.components[component] as Record<string, unknown> | undefined) ?? null;
}

/**
 * Reads a value that Bevy's remote protocol may serialize as an option enum or
 * as the plain value.
 *
 * @param value Serialized value.
 * @returns The inner value, or null for none.
 */
export function previewE2eOptionRead(value: unknown): unknown {
  if (value === 'None' || value === null || value === undefined) {
    return null;
  }
  const some = (value as { Some?: unknown }).Some;
  return some === undefined ? value : some;
}

/**
 * Reads the values of a properties component as plain scalars, whatever enum
 * form the remote protocol used.
 *
 * @param properties Serialized properties component.
 * @returns Property name to scalar value.
 */
export function previewE2ePropertiesRead(properties: Record<string, unknown> | null): Record<string, unknown> {
  const values = (properties?.['values'] ?? {}) as Record<string, unknown>;
  const scalars: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(values)) {
    const variant = value as Record<string, unknown>;
    scalars[name] = variant['Text'] ?? variant['Number'] ?? variant['Bool'] ?? value;
  }
  return scalars;
}
