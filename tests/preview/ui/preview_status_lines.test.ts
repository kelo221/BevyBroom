import { describe, it, expect } from 'vitest';
import { previewStatusLinesBuild, type PreviewStatusSnapshot } from '@/preview/ui/preview_status_lines.js';
import type { PreviewBridgeStatus } from '@/preview/protocol/preview_protocol_types.js';

/**
 * Builds a game status with every counter set, overridable per test.
 *
 * @param overrides Fields that differ from the defaults.
 * @returns Complete bridge status.
 */
function statusCreate(overrides: Partial<PreviewBridgeStatus> = {}): PreviewBridgeStatus {
  return {
    bridge_version: '0.1.0',
    protocol: 1,
    instance_id: 'instance-status-test',
    project_id: 'project-status-test',
    document_id: null,
    state_revision_received: 7,
    state_revision_applied: 7,
    geometry_revision_received: 3,
    geometry_revision_applied: 3,
    geometry_revision_failed: 0,
    geometry_loading: false,
    geometry_file: 'level.glb',
    light_count: 2,
    realtime_light_count: 1,
    realtime_shadow_count: 0,
    realtime_light_budget: 8,
    shadow_cubemap_budget: 2,
    room_count: 2,
    portal_count: 1,
    portal_state: 'active',
    portal_message: null,
    bake_state: 'needs_bake',
    bake_message: null,
    catalog_material_count: 4,
    catalog_error: null,
    placeable_class_count: 3,
    placed_component_count: 5,
    data_asset_generation: 2,
    errors: [],
    ...overrides,
  };
}

/**
 * Builds a link snapshot around a status.
 *
 * @param overrides Fields that differ from the defaults.
 * @returns Snapshot passed to the line builder.
 */
function snapshotCreate(overrides: Partial<PreviewStatusSnapshot> = {}): PreviewStatusSnapshot {
  return {
    connectionState: 'connected',
    status: statusCreate(),
    sentStateRevision: 7,
    sentGeometryRevision: 3,
    lastError: '',
    ...overrides,
  };
}

describe('previewStatusLinesBuild', () => {
  it('shows only the connection line while disconnected, even with an old status', () => {
    const lines = previewStatusLinesBuild(snapshotCreate({ connectionState: 'disconnected' }));
    expect(lines).toEqual(['Not connected']);
  });

  it('describes revisions, lights, bake, materials and game components of a connected game', () => {
    const snapshot = snapshotCreate();
    const status = snapshot.status;
    const lines = previewStatusLinesBuild(snapshot).join('\n');
    expect(lines).toContain('Connected');
    expect(lines).toContain(status?.project_id ?? 'missing');
    expect(lines).toContain(`sent ${snapshot.sentStateRevision}, applied ${status?.state_revision_applied}`);
    expect(lines).toContain(`(${status?.geometry_file})`);
    expect(lines).toContain(`Lights: ${status?.light_count}`);
    expect(lines).toContain('bake needed');
    expect(lines).toContain(`Game materials: ${status?.catalog_material_count}`);
    expect(lines).toContain(
      `Game components: ${status?.placed_component_count} placed, ${status?.placeable_class_count} classes`,
    );
    expect(lines).toContain(`Rooms: ${status?.room_count}, portals: ${status?.portal_count} (culling active)`);
  });

  it('explains why room and portal culling is off and names a failed geometry revision', () => {
    const status = statusCreate({
      portal_state: 'disabled',
      portal_message: 'rooms overlap',
      geometry_revision_failed: 4,
      geometry_revision_applied: 3,
    });
    const joined = previewStatusLinesBuild(snapshotCreate({ status })).join('\n');
    expect(joined).toContain('(culling off) — rooms overlap');
    expect(joined).toContain('Geometry 4 failed to load; showing 3');
  });

  it('reports loading geometry, catalog errors, the newest game error and the last link error', () => {
    const status = statusCreate({
      geometry_loading: true,
      catalog_error: 'catalog broken',
      errors: [
        { sequence: 1, message: 'older problem' },
        { sequence: 2, message: 'newest problem' },
      ],
    });
    const lines = previewStatusLinesBuild(snapshotCreate({ status, lastError: 'request failed' }));
    const joined = lines.join('\n');
    expect(joined).toContain('(loading)');
    expect(joined).toContain('catalog broken');
    expect(joined).toContain('Game error: newest problem');
    expect(joined).not.toContain('older problem');
    expect(lines[lines.length - 1]).toBe('Last error: request failed');
  });
});
