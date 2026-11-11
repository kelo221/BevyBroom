import type * as THREE from 'three';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModelRegistry } from '@/solid/model/solid_model_registry.js';
import { modifierStackScopeOf, type ModifierStackScope } from './modifier_stack_scope.js';
import { modifierStackBuiltTreeBuild } from './modifier_stack_built_tree.js';
import { modifierStackBuiltTouched } from './modifier_stack_built_touch.js';

/** What a volume affects in one solid, before its exclusions. */
export interface ModifierStackTargets {
  /** Scope of the volume in this solid, or null when it affects nothing here. */
  scope: ModifierStackScope | null;
  /** Ids of authored brushes whose built geometry meets the volume. */
  authoredIds: ReadonlySet<string>;
}

/**
 * Resolves what a volume affects in one solid. Three rules apply in turn: only
 * nodes in the volume's parent (its CSG group or solid root), only nodes that
 * come before it there, and only brushes whose built geometry, the surface
 * those earlier nodes build, meets the volume box. Air inside a subtracted room
 * or window is not built geometry. Everything the volume and later nodes do is
 * left out, so the result never feeds back on itself.
 *
 * @param volume Modifier volume.
 * @param solidRoot Solid model root.
 * @param authored Authored brushes of the solid.
 * @returns Targets before exclusions.
 */
export function modifierStackTargetsResolve(
  volume: THREE.Object3D,
  solidRoot: THREE.Object3D,
  authored: readonly SolidBrushInstance[],
): ModifierStackTargets {
  const inverted = SolidModelRegistry.get(solidRoot)?.isInvertedWorld() ?? false;
  const scope = modifierStackScopeOf(volume, solidRoot, inverted);
  if (!scope) return { scope, authoredIds: new Set() };
  volume.updateWorldMatrix(true, false);
  const sources = { authored: new Map(authored.map((brush) => [brush.id, brush])), volume };
  const nodes = modifierStackBuiltTreeBuild(scope.before, sources);
  const touched = modifierStackBuiltTouched(nodes, scope.startsSolid, volume);
  return { scope, authoredIds: new Set(touched.map((leaf) => leaf.brush.id)) };
}
