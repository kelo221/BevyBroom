import * as THREE from 'three';
import { entityKindRead } from '@/entity/model/entity_owner_keys.js';
import { GAME_ENTITY_COMPONENTS_USERDATA_KEY } from '@/game_entity/component/game_entity_component_store.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import { isSolidModelObject } from '@/solid/model/solid_model_keys.js';
import { VisGroupObjectCollector } from './visgroup_object_collector.js';
import type { AutoVisGroupId, AutoVisGroupNode } from './visgroup_types.js';

/** Entity kind of light owners. */
const VISGROUP_ENTITY_KIND_LIGHT = 'light';

/** Entity kinds shown under Rooms & Portals. */
const VISGROUP_ENTITY_KINDS_ROOMS_PORTALS: ReadonlySet<string> = new Set(['room', 'portal']);

/** Entity kind of game entity owners. */
const VISGROUP_ENTITY_KIND_GAME_ENTITY = 'game_entity';

/** Tree of automatic VisGroups shown in the Auto tab. */
const AUTO_VIS_GROUP_TREE: AutoVisGroupNode = {
  id: 'all',
  label: 'All',
  children: [
    {
      id: 'world_geometry',
      label: 'World Geometry',
      children: [
        { id: 'solids', label: 'Solids', children: [] },
        { id: 'meshes', label: 'Content Meshes', children: [] },
      ],
    },
    {
      id: 'entities',
      label: 'Entities',
      children: [
        { id: 'lights', label: 'Lights', children: [] },
        { id: 'rooms_portals', label: 'Rooms & Portals', children: [] },
        { id: 'game_entities', label: 'Game Entities', children: [] },
      ],
    },
  ],
};

/** Sorts scene objects into the automatic VisGroups by their kind. */
export class VisGroupClassifierAuto {
  /**
   * Returns the automatic VisGroup tree.
   *
   * @returns Root node `All` with its nested groups.
   */
  static treeBuild(): AutoVisGroupNode {
    return AUTO_VIS_GROUP_TREE;
  }

  /**
   * Lists every automatic VisGroup an object belongs to, including parents.
   *
   * @param object Scene object.
   * @returns Matching automatic VisGroup ids; empty for editor helpers.
   */
  static classify(object: THREE.Object3D): AutoVisGroupId[] {
    if (VisGroupObjectCollector.editorHelperIs(object)) {
      return [];
    }
    const leafId = VisGroupClassifierAuto.leafCategoryResolve(object);
    if (leafId === null) {
      return ['all'];
    }
    return ['all', VisGroupClassifierAuto.parentCategoryResolve(leafId), leafId];
  }

  /**
   * Returns whether an object belongs to an automatic VisGroup.
   *
   * @param object Scene object.
   * @param visGroupId Automatic VisGroup id.
   * @returns True for members.
   */
  static memberIs(object: THREE.Object3D, visGroupId: AutoVisGroupId): boolean {
    return VisGroupClassifierAuto.classify(object).includes(visGroupId);
  }

  /**
   * Collects the logical scene objects that belong to an automatic VisGroup.
   *
   * @param worldRoot World root whose content is searched.
   * @param visGroupId Automatic VisGroup id.
   * @returns Member objects.
   */
  static membersCollect(worldRoot: THREE.Object3D, visGroupId: AutoVisGroupId): THREE.Object3D[] {
    return VisGroupObjectCollector.logicalObjectsCollect(worldRoot).filter((object) =>
      VisGroupClassifierAuto.memberIs(object, visGroupId),
    );
  }

  /**
   * Resolves the most specific automatic VisGroup of an object.
   *
   * @param object Scene object.
   * @returns Leaf VisGroup id, or null for objects of no known kind.
   */
  static leafCategoryResolve(object: THREE.Object3D): AutoVisGroupId | null {
    const entityCategory = VisGroupClassifierAuto.entityCategoryResolve(object);
    if (entityCategory !== null) {
      return entityCategory;
    }
    if (isSolidModelObject(object) || SolidBrushVisual.isBrushObject(object)) {
      return 'solids';
    }
    if (object instanceof THREE.Mesh) {
      return 'meshes';
    }
    return null;
  }

  /**
   * Resolves the entity category of an object from its entity kind, light type
   * or game components.
   *
   * @param object Scene object.
   * @returns Entity leaf VisGroup id, or null when the object is no entity.
   */
  private static entityCategoryResolve(object: THREE.Object3D): AutoVisGroupId | null {
    const kind = entityKindRead(object);
    if (kind === VISGROUP_ENTITY_KIND_LIGHT || object instanceof THREE.Light) {
      return 'lights';
    }
    if (kind !== null && VISGROUP_ENTITY_KINDS_ROOMS_PORTALS.has(kind)) {
      return 'rooms_portals';
    }
    if (kind === VISGROUP_ENTITY_KIND_GAME_ENTITY || VisGroupClassifierAuto.gameComponentsPresent(object)) {
      return 'game_entities';
    }
    return kind !== null ? 'entities' : null;
  }

  /**
   * Returns the middle tree level of a leaf VisGroup.
   *
   * @param leafId Leaf VisGroup id.
   * @returns `world_geometry` or `entities`.
   */
  private static parentCategoryResolve(leafId: AutoVisGroupId): AutoVisGroupId {
    return leafId === 'solids' || leafId === 'meshes' ? 'world_geometry' : 'entities';
  }

  /**
   * Returns whether an object carries at least one game component.
   *
   * @param object Scene object.
   * @returns True when game components are stored on it.
   */
  private static gameComponentsPresent(object: THREE.Object3D): boolean {
    const stored: unknown = object.userData[GAME_ENTITY_COMPONENTS_USERDATA_KEY];
    return typeof stored === 'object' && stored !== null && Object.keys(stored).length > 0;
  }
}
