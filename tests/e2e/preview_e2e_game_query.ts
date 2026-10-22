import type { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';

/** Type path of DynLight's room component in Bevy's remote protocol. */
export const PREVIEW_E2E_ROOM_COMPONENT = 'dynlight::portals::authoring::Room';

/** Type path of DynLight's portal component in Bevy's remote protocol. */
export const PREVIEW_E2E_PORTAL_COMPONENT = 'dynlight::portals::authoring::Portal';

/** Type path of DynLight's closed door marker in Bevy's remote protocol. */
export const PREVIEW_E2E_CLOSED_PORTAL_COMPONENT = 'dynlight::portals::authoring::ClosedPortal';

/** Type path of DynLight's light component in Bevy's remote protocol. */
export const PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT = 'dynlight::light::component::DynamicLight';

/** Type path of DynLight's light intensity effect in Bevy's remote protocol. */
export const PREVIEW_E2E_LIGHT_EFFECT_COMPONENT = 'dynlight::effects::effect::LightEffect';

/** Type path of DynLight's light fog volume in Bevy's remote protocol. */
export const PREVIEW_E2E_VOLUMETRIC_LIGHT_COMPONENT = 'dynlight::fog::volumetric::VolumetricLight';

/** Type path of DynLight's spot light cookie in Bevy's remote protocol. */
export const PREVIEW_E2E_LIGHT_COOKIE_COMPONENT = 'dynlight::cookies::LightCookie';

/** One entity row of a Bevy remote protocol query. */
export interface PreviewE2eEntityRow {
  entity: number;
  components: Record<string, unknown>;
  has?: Record<string, boolean>;
}

/**
 * Queries every game entity that has all of the given components, reporting for
 * each whether it also has the optional ones.
 *
 * @param transport Transport to the game's bridge.
 * @param components Type paths every row must have; their values are returned.
 * @param hasComponents Type paths reported as present or absent per row.
 * @returns Entity rows.
 */
export function previewE2eEntityRowsQuery(
  transport: PreviewLinkTransport,
  components: string[],
  hasComponents: string[] = [],
): Promise<PreviewE2eEntityRow[]> {
  const params = { data: { components, has: hasComponents }, filter: {} };
  return transport.call<PreviewE2eEntityRow[]>('world.query', params, 5000);
}

/**
 * Opens the game's only portal the way gameplay would, by removing its closed
 * door marker directly in the game world.
 *
 * @param transport Transport to the game's bridge.
 */
export async function previewE2eOnlyPortalOpenByGameplay(transport: PreviewLinkTransport): Promise<void> {
  const rows = await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_PORTAL_COMPONENT]);
  const portalRow = rows[0];
  if (rows.length !== 1 || portalRow === undefined) {
    throw new Error(`Expected one portal in the game, found ${rows.length}`);
  }
  const params = { entity: portalRow.entity, components: [PREVIEW_E2E_CLOSED_PORTAL_COMPONENT] };
  await transport.call<unknown>('world.remove_components', params, 5000);
}

/**
 * Returns whether the game has exactly one portal and it is closed or open as
 * expected.
 *
 * @param transport Transport to the game's bridge.
 * @param isClosed Whether the portal must carry the closed door marker.
 * @returns True when the only portal matches.
 */
export async function previewE2eOnlyPortalClosedIs(
  transport: PreviewLinkTransport,
  isClosed: boolean,
): Promise<boolean> {
  const rows = await previewE2eEntityRowsQuery(
    transport,
    [PREVIEW_E2E_PORTAL_COMPONENT],
    [PREVIEW_E2E_CLOSED_PORTAL_COMPONENT],
  );
  return rows.length === 1 && rows[0]?.has?.[PREVIEW_E2E_CLOSED_PORTAL_COMPONENT] === isClosed;
}
