import type { AuthoredLogicOutput } from '@/game_entity/logic/game_entity_logic_types.js';
import type { GameEntityComponents } from '@/game_entity/component/game_entity_component_store.js';

/** Serializable node inside a Hammer++-style Prefab template hierarchy. */
export interface PrefabNodeRecord {
  /** Authored object name. */
  name: string;
  /** Whether the node is a Group or a Mesh. */
  kind: 'group' | 'mesh';
  /** Position relative to parent (or prefab pivot for root nodes). */
  position: [number, number, number];
  /** Local rotation quaternion `[x, y, z, w]`. */
  quaternion: [number, number, number, number];
  /** Local scale `[x, y, z]`. */
  scale: [number, number, number];
  /** Authored game component overrides. */
  gameComponents: GameEntityComponents;
  /** Authored entity I/O output connections. */
  logicOutputs: AuthoredLogicOutput[];
  /** Authored designer comments. */
  comments: string;
  /** Child nodes in the prefab hierarchy. */
  children: PrefabNodeRecord[];
}

/** Named, categorized Prefab template stored in the Prefab library. */
export interface PrefabTemplate {
  /** Unique template identifier. */
  id: string;
  /** Display name of the prefab. */
  name: string;
  /** Library category name (e.g. `'Prefabs'`, `'Doors'`, `'Architecture'`). */
  category: string;
  /** Root nodes captured in this prefab. */
  nodes: PrefabNodeRecord[];
}
