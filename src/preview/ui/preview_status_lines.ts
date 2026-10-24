import type { PreviewBridgeStatus } from '@/preview/protocol/preview_protocol_types.js';
import type { PreviewLinkConnectionState } from '@/preview/link/preview_link_controller.js';

/** Everything the status panel shows. */
export interface PreviewStatusSnapshot {
  connectionState: PreviewLinkConnectionState;
  status: PreviewBridgeStatus | null;
  sentStateRevision: number;
  sentGeometryRevision: number;
  lastError: string;
}

/** Labels of the connection states. */
const PREVIEW_CONNECTION_LABELS: Record<PreviewLinkConnectionState, string> = {
  disconnected: 'Not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  unreachable: 'Game not reachable, retrying…',
  incompatible: 'Game is incompatible, nothing is sent',
};

/** Labels of the bake states. */
const PREVIEW_BAKE_LABELS: Record<PreviewBridgeStatus['bake_state'], string> = {
  no_bake: 'No bake',
  current: 'Bake is current',
  needs_bake: 'Scene changed, bake needed',
  baking: 'Baking…',
  failed: 'Bake failed',
};

/** Labels of the room and portal culling states. */
const PREVIEW_PORTAL_LABELS: Record<PreviewBridgeStatus['portal_state'], string> = {
  empty: 'no rooms, culling off',
  active: 'culling active',
  disabled: 'culling off',
};

/**
 * Builds the human-readable status lines of the game preview panel.
 *
 * @param snapshot Link and game status.
 * @returns Lines in display order.
 */
export function previewStatusLinesBuild(snapshot: PreviewStatusSnapshot): string[] {
  const lines = [PREVIEW_CONNECTION_LABELS[snapshot.connectionState]];
  const status = snapshot.status;
  if (status && snapshot.connectionState === 'connected') {
    lines.push(...previewStatusGameLines(snapshot, status));
  }
  if (snapshot.lastError !== '') {
    lines.push(`Last error: ${snapshot.lastError}`);
  }
  return lines;
}

/**
 * Builds the lines describing the connected game.
 *
 * @param snapshot Link snapshot.
 * @param status Game status.
 * @returns Game lines.
 */
function previewStatusGameLines(snapshot: PreviewStatusSnapshot, status: PreviewBridgeStatus): string[] {
  const geometryState = status.geometry_loading ? 'loading' : (status.geometry_file ?? 'none');
  const lines = [
    `Project: ${status.project_id || '—'}`,
    `State: sent ${snapshot.sentStateRevision}, applied ${status.state_revision_applied}`,
    `Geometry: sent ${snapshot.sentGeometryRevision}, shown ${status.geometry_revision_applied} (${geometryState})`,
    previewStatusLightLine(status),
    previewStatusPortalLine(status),
    `Bake: ${PREVIEW_BAKE_LABELS[status.bake_state] ?? status.bake_state}${status.bake_message ? ` — ${status.bake_message}` : ''}`,
    `Game materials: ${status.catalog_material_count}${status.catalog_error ? ` — ${status.catalog_error}` : ''}`,
    `Game components: ${status.placed_component_count} placed, ${status.placeable_class_count} classes`,
  ];
  return [...lines, ...previewStatusLightBudgetLines(status), ...previewStatusProblemLines(status)];
}

/**
 * Builds the lines naming a geometry revision that failed to load and the
 * newest game error.
 *
 * @param status Game status.
 * @returns Zero, one or two lines.
 */
function previewStatusProblemLines(status: PreviewBridgeStatus): string[] {
  const lines: string[] = [];
  if (status.geometry_revision_failed > 0 && status.geometry_revision_failed >= status.geometry_revision_applied) {
    lines.push(
      `Geometry ${status.geometry_revision_failed} failed to load; showing ${status.geometry_revision_applied}`,
    );
  }
  const newestError = status.errors[status.errors.length - 1];
  if (newestError) {
    lines.push(`Game error: ${newestError.message}`);
  }
  return lines;
}

/**
 * Builds the lights line with the realtime light and realtime shadow counts
 * against the game's budgets.
 *
 * @param status Game status.
 * @returns Status line.
 */
function previewStatusLightLine(status: PreviewBridgeStatus): string {
  const realtime = `${status.realtime_light_count}/${status.realtime_light_budget} realtime`;
  const shadows = `${status.realtime_shadow_count}/${status.shadow_cubemap_budget} realtime shadows`;
  return `Lights: ${status.light_count} (${realtime}, ${shadows})`;
}

/**
 * Builds the lines explaining a realtime light or realtime shadow budget the
 * scene goes over, and what the game does about it.
 *
 * @param status Game status.
 * @returns Zero, one or two lines.
 */
function previewStatusLightBudgetLines(status: PreviewBridgeStatus): string[] {
  const lines: string[] = [];
  if (status.realtime_light_count > status.realtime_light_budget) {
    lines.push(
      `Over the realtime light budget: ${status.realtime_light_count} of ${status.realtime_light_budget}; only the ones nearest the camera are lit in real time`,
    );
  }
  if (status.realtime_shadow_count > status.shadow_cubemap_budget) {
    lines.push(
      `Over the realtime shadow budget: ${status.realtime_shadow_count} of ${status.shadow_cubemap_budget}; only ${status.shadow_cubemap_budget} lights cast realtime shadows at once`,
    );
  }
  return lines;
}

/**
 * Builds the rooms and portals line, including the reason when the game turned
 * culling off.
 *
 * @param status Game status.
 * @returns Status line.
 */
function previewStatusPortalLine(status: PreviewBridgeStatus): string {
  const label = PREVIEW_PORTAL_LABELS[status.portal_state] ?? status.portal_state;
  const reason = status.portal_message ? ` — ${status.portal_message}` : '';
  return `Rooms: ${status.room_count}, portals: ${status.portal_count} (${label})${reason}`;
}
