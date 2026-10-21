/**
 * Wire types of the game preview protocol. Field names are snake_case because
 * the game bridge reads them with serde.
 */

import type { PreviewAuthoredComponents } from '@/preview/protocol/preview_protocol_placeable_types.js';

/** Wire protocol version spoken by this editor. */
export const PREVIEW_PROTOCOL_VERSION = 3;

/** Default game preview endpoint of the Bevy remote server. */
export const PREVIEW_DEFAULT_ENDPOINT = 'http://127.0.0.1:15702';

/** JSON-RPC method names served by the game bridge. */
export const PREVIEW_METHOD = {
  applyState: 'broom.apply_state',
  publishGeometry: 'broom.publish_geometry',
  status: 'broom.status',
  catalog: 'broom.catalog',
  readAsset: 'broom.read_asset',
  bakePreview: 'broom.bake_preview',
  loadLevel: 'broom.load_level',
  placeableClasses: 'broom.placeable_classes',
  dataAssetRead: 'broom.data_asset_read',
  dataAssetWrite: 'broom.data_asset_write',
} as const;

/** Every authored object kind the game bridge understands. */
export const PREVIEW_OBJECT_KINDS = ['mesh', 'group', 'solid', 'light', 'room', 'portal', 'game_entity'] as const;

/** What an authored object is. */
export type PreviewObjectKind = (typeof PREVIEW_OBJECT_KINDS)[number];

/**
 * Returns whether a kind name is an authored object kind the game bridge
 * understands.
 *
 * @param kind Candidate kind name.
 * @returns True for wire object kinds.
 */
export function previewObjectKindIs(kind: string): kind is PreviewObjectKind {
  return (PREVIEW_OBJECT_KINDS as readonly string[]).includes(kind);
}

/** One authored light in game units. */
export interface PreviewAuthoredLight {
  light_type: 'point' | 'spot';
  color: [number, number, number];
  intensity: number;
  radius: number;
  falloff: number;
  inner_cutoff: number;
  outer_cutoff: number;
  realtime: boolean;
  shadows: 'raytraced' | 'realtime';
  enabled: boolean;
}

/** One authored room cell: a box of these half sizes under the object transform. */
export interface PreviewAuthoredRoom {
  half_size: [number, number, number];
}

/**
 * One authored portal: a rectangle of this full width and height in the
 * object's local XY plane, front along local +Z.
 */
export interface PreviewAuthoredPortal {
  size: [number, number];
  closed: boolean;
}

/** One object of the authored hierarchy with its local transform. */
export interface PreviewAuthoredObject {
  id: string;
  parent_id: string | null;
  name: string;
  kind: PreviewObjectKind;
  visible: boolean;
  translation: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
  light?: PreviewAuthoredLight;
  room?: PreviewAuthoredRoom;
  portal?: PreviewAuthoredPortal;
  components?: PreviewAuthoredComponents;
}

/** Complete authored snapshot of one document. */
export interface PreviewAuthoredState {
  protocol: number;
  project_id: string;
  document_id: string;
  session_id: string;
  revision: number;
  geometry_revision: number;
  objects: PreviewAuthoredObject[];
}

/** Committed level geometry as a binary glTF file. */
export interface PreviewGeometryPublication {
  protocol: number;
  document_id: string;
  session_id: string;
  geometry_revision: number;
  level_name: string;
  glb_base64: string;
}

/** Reply to a state or geometry request. */
export interface PreviewRevisionReply {
  accepted: boolean;
  verdict: string;
  revision: number;
}

/** One error the game bridge reported. */
export interface PreviewBridgeError {
  sequence: number;
  message: string;
}

/** Live status of the game bridge. */
export interface PreviewBridgeStatus {
  bridge_version: string;
  protocol: number;
  instance_id: string;
  project_id: string;
  document_id: string | null;
  state_revision_received: number;
  state_revision_applied: number;
  geometry_revision_received: number;
  geometry_revision_applied: number;
  /** Newest geometry revision that was accepted but failed to load; 0 when none. */
  geometry_revision_failed: number;
  geometry_loading: boolean;
  geometry_file: string | null;
  light_count: number;
  realtime_light_count: number;
  realtime_shadow_count: number;
  realtime_light_budget: number;
  shadow_cubemap_budget: number;
  room_count: number;
  portal_count: number;
  portal_state: 'empty' | 'active' | 'disabled';
  portal_message: string | null;
  bake_state: 'no_bake' | 'current' | 'needs_bake' | 'baking' | 'failed';
  bake_message: string | null;
  catalog_material_count: number;
  catalog_error: string | null;
  placeable_class_count: number;
  placed_component_count: number;
  data_asset_generation: number;
  errors: PreviewBridgeError[];
}

/** One game material of the catalog. */
export interface PreviewCatalogMaterial {
  id: string;
  label: string;
  base_color: [number, number, number, number];
  base_color_texture: string | null;
  tile_meters?: [number, number] | null;
}

/** The game material catalog. */
export interface PreviewMaterialCatalog {
  catalog_version: number;
  materials: PreviewCatalogMaterial[];
}

/** Reply to a catalog request. */
export interface PreviewCatalogReply {
  catalog: PreviewMaterialCatalog | null;
  error: string | null;
  generation: number;
}

/** Reply to an asset read request. */
export interface PreviewAssetReply {
  path: string;
  base64: string;
}
