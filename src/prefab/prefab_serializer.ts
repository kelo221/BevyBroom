import * as THREE from 'three';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import type { AuthoredLogicOutput } from '@/game_entity/logic/game_entity_logic_types.js';
import type { PrefabNodeRecord, PrefabTemplate } from './prefab_types.js';

/**
 * Captures scene object hierarchies into reusable `PrefabTemplate` definitions
 * and instantiates them at target world positions with automatic internal
 * Entity I/O target name scoping.
 */
export class PrefabSerializer {
  /**
   * Captures a list of root objects into a recentered `PrefabTemplate`.
   *
   * @param id Unique prefab identifier.
   * @param name Display name.
   * @param category Library category name.
   * @param objects Root scene objects to capture.
   * @returns Captured `PrefabTemplate`.
   */
  static captureObjects(
    id: string,
    name: string,
    category: string,
    objects: readonly THREE.Object3D[],
  ): PrefabTemplate {
    const pivot = PrefabSerializer.computeCentroid(objects);
    const nodes = objects.map((obj) => PrefabSerializer.captureNode(obj, pivot));
    return {
      id,
      name,
      category: category.trim() || 'Prefabs',
      nodes,
    };
  }

  /**
   * Instantiates a `PrefabTemplate` at `targetOrigin`, scoping internal Entity
   * I/O target names with `scopeSuffix` when non-empty so multiple stamped
   * instances never cross-trigger each other.
   *
   * @param template Prefab template to stamp.
   * @param targetOrigin World position where the prefab pivot is placed.
   * @param scopeSuffix Optional suffix (e.g. `'1'`, `'inst2'`) appended to
   *   internal names.
   * @returns Root `THREE.Group` containing the stamped prefab objects.
   */
  static instantiateTemplate(
    template: PrefabTemplate,
    targetOrigin: THREE.Vector3,
    scopeSuffix: string = '',
  ): THREE.Group {
    const internalNames = new Set<string>();
    PrefabSerializer.collectInternalNames(template.nodes, internalNames);
    const suffix = scopeSuffix.trim();
    const rootGroup = new THREE.Group();
    rootGroup.name = suffix ? `${template.name}_${suffix}` : template.name;
    rootGroup.position.copy(targetOrigin);
    for (const node of template.nodes) {
      rootGroup.add(PrefabSerializer.instantiateNode(node, internalNames, suffix));
    }
    return rootGroup;
  }

  /**
   * Computes the average world position of the given objects as the prefab
   * pivot.
   *
   * @param objects Root objects.
   * @returns Centroid vector.
   */
  private static computeCentroid(objects: readonly THREE.Object3D[]): THREE.Vector3 {
    if (objects.length === 0) {
      return new THREE.Vector3();
    }
    const sum = new THREE.Vector3();
    for (const obj of objects) {
      sum.add(obj.position);
    }
    return sum.divideScalar(objects.length);
  }

  /**
   * Recursively captures one `THREE.Object3D` into a `PrefabNodeRecord`.
   *
   * @param object Source object.
   * @param offset Offset subtracted from this node's position (zero for
   *   children).
   * @returns Serializable node record.
   */
  private static captureNode(object: THREE.Object3D, offset: THREE.Vector3): PrefabNodeRecord {
    const pos = object.position.clone().sub(offset);
    return {
      name: object.name,
      kind: object instanceof THREE.Mesh ? 'mesh' : 'group',
      position: [pos.x, pos.y, pos.z],
      quaternion: [object.quaternion.x, object.quaternion.y, object.quaternion.z, object.quaternion.w],
      scale: [object.scale.x, object.scale.y, object.scale.z],
      gameComponents: GameEntityComponentStore.read(object),
      logicOutputs: GameEntityLogicStore.read(object),
      comments: GameEntityLogicStore.commentsRead(object),
      children: object.children.map((child) => PrefabSerializer.captureNode(child, new THREE.Vector3())),
    };
  }

  /**
   * Collects all non-empty node names inside a prefab template hierarchy.
   *
   * @param nodes Prefab node list.
   * @param out Set populated with internal names.
   */
  private static collectInternalNames(nodes: readonly PrefabNodeRecord[], out: Set<string>): void {
    for (const node of nodes) {
      const trimmed = node.name.trim();
      if (trimmed) {
        out.add(trimmed);
      }
      PrefabSerializer.collectInternalNames(node.children, out);
    }
  }

  /**
   * Instantiates one `PrefabNodeRecord` and scopes its name and internal I/O
   * targets.
   *
   * @param node Node record.
   * @param internalNames Set of all member names in the prefab.
   * @param suffix Scoping suffix (empty for unscoped original).
   * @returns Created `THREE.Object3D`.
   */
  private static instantiateNode(
    node: PrefabNodeRecord,
    internalNames: ReadonlySet<string>,
    suffix: string,
  ): THREE.Object3D {
    const obj = node.kind === 'mesh' ? new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)) : new THREE.Group();
    obj.name = PrefabSerializer.scopeName(node.name, internalNames, suffix);
    obj.position.set(...node.position);
    obj.quaternion.set(...node.quaternion);
    obj.scale.set(...node.scale);
    GameEntityComponentStore.write(obj, node.gameComponents);
    GameEntityLogicStore.write(obj, PrefabSerializer.scopeLogicRows(node.logicOutputs, internalNames, suffix));
    GameEntityLogicStore.commentsWrite(obj, node.comments);
    for (const child of node.children) {
      obj.add(PrefabSerializer.instantiateNode(child, internalNames, suffix));
    }
    return obj;
  }

  /**
   * Appends `_${suffix}` to a name when `suffix` is non-empty and the name is
   * in `internalNames`.
   *
   * @param rawName Original name.
   * @param internalNames Set of internal prefab member names.
   * @param suffix Scope suffix.
   * @returns Scoped name.
   */
  private static scopeName(rawName: string, internalNames: ReadonlySet<string>, suffix: string): string {
    const trimmed = rawName.trim();
    if (!suffix || !trimmed || !internalNames.has(trimmed)) {
      return rawName;
    }
    return `${trimmed}_${suffix}`;
  }

  /**
   * Scopes target references in logic output rows that point to internal prefab
   * members.
   *
   * @param rows Original logic output rows.
   * @param internalNames Internal prefab member names.
   * @param suffix Scope suffix.
   * @returns Scoped logic output rows.
   */
  private static scopeLogicRows(
    rows: readonly AuthoredLogicOutput[],
    internalNames: ReadonlySet<string>,
    suffix: string,
  ): AuthoredLogicOutput[] {
    return rows.map((row) => ({
      ...row,
      target: PrefabSerializer.scopeName(row.target, internalNames, suffix),
    }));
  }
}
