import type { PreviewComponentFields } from '@/preview/protocol/preview_protocol_placeable_types.js';

/**
 * Wire types of data assets: game files holding one reflected value. A file
 * stores only the fields that differ from the type's default, by field path, in
 * the same normalized form as component overrides.
 */

/** Parameters of a data asset read. */
export interface PreviewDataAssetReadRequest {
  path: string;
}

/** Reply to a data asset read. */
export interface PreviewDataAssetReadReply {
  path: string;
  type_path: string;
  values: PreviewComponentFields;
}

/** Parameters of a data asset write; the file is created when missing. */
export interface PreviewDataAssetWriteRequest {
  path: string;
  type_path: string;
  values: PreviewComponentFields;
}

/**
 * Reply to a data asset write. The game status's `data_asset_generation`
 * reaches `generation` once the file is written and reloading.
 */
export interface PreviewDataAssetWriteReply {
  path: string;
  generation: number;
}
