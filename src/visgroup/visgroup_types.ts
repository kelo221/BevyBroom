import type * as THREE from 'three';

/** UserData key holding the ids of every user VisGroup an object belongs to. */
export const VISGROUP_IDS_USERDATA_KEY = 'visGroupIds';

/** A VisGroup the user created and assigns objects to by hand. */
export interface UserVisGroup {
  /** Unique id, never equal to an automatic VisGroup id. */
  id: string;
  /** Display name. */
  name: string;
  /** False while the members of the VisGroup are hidden. */
  visible: boolean;
  /** Swatch color as a 24-bit hex number. */
  color: number;
}

/** Id of a VisGroup whose members are found automatically by object kind. */
export type AutoVisGroupId =
  'all' | 'world_geometry' | 'solids' | 'meshes' | 'entities' | 'lights' | 'rooms_portals' | 'game_entities';

/** Every automatic VisGroup id, parents before their children. */
export const AUTO_VIS_GROUP_IDS: readonly AutoVisGroupId[] = [
  'all',
  'world_geometry',
  'solids',
  'meshes',
  'entities',
  'lights',
  'rooms_portals',
  'game_entities',
];

/** One node of the automatic VisGroup tree. */
export interface AutoVisGroupNode {
  /** Automatic VisGroup id. */
  readonly id: AutoVisGroupId;
  /** Display label. */
  readonly label: string;
  /** Nested automatic VisGroups. */
  readonly children: readonly AutoVisGroupNode[];
}

/** Selection operations the VisGroup system and its panel need. */
export interface VisGroupSelectionTarget {
  /**
   * Replaces the selection.
   *
   * @param meshes Meshes that become the selection.
   * @param inspectorObjects Hierarchy objects the selection represents.
   * @returns True when applied.
   */
  setSelection(meshes: THREE.Mesh[], inspectorObjects?: THREE.Object3D[]): boolean;
  /**
   * Returns the hierarchy objects of the current selection.
   *
   * @returns Selected hierarchy objects.
   */
  getInspectorObjects(): THREE.Object3D[];
}

/**
 * Returns whether a string is an automatic VisGroup id.
 *
 * @param visGroupId Candidate id.
 * @returns True for automatic VisGroup ids.
 */
export function visGroupIdAutoIs(visGroupId: string): visGroupId is AutoVisGroupId {
  return (AUTO_VIS_GROUP_IDS as readonly string[]).includes(visGroupId);
}
