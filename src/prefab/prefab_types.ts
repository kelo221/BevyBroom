import type { ClipboardPayload } from '@/clipboard/payload/clipboard_payload_types.js';

/**
 * Named, categorized prefab: a full copy of the captured objects, brushes and
 * game data in the clipboard payload format, placed as a copy every time.
 */
export interface PrefabTemplate {
  /** Unique template identifier; a project prefab's file name without ".json". */
  id: string;
  /** Display name of the prefab. */
  name: string;
  /** Library category name (e.g. `'Prefabs'`, `'Doors'`, `'Architecture'`). */
  category: string;
  /** Captured objects and brushes at the positions they were captured at. */
  payload: ClipboardPayload;
}
