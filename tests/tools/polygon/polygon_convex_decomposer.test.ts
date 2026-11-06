import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PolygonConvexDecomposer } from '@/tools/polygon/polygon_convex_decomposer.js';
import { polygonOutlineRecipeFromFrame, polygonOutlineRecipeRead } from '@/tools/polygon/polygon_outline_recipe.js';
import { PolygonBrushCommitter } from '@/tools/polygon/polygon_brush_committer.js';
import { CommandStack } from '@/commands/command_stack.js';
import { SolidModel } from '@/solid/model/solid_model.js';

describe('PolygonConvexDecomposer and PolygonBrushCommitter', () => {
  it('keeps a convex pentagon as one convex piece and decomposes an L-shape into two convex pieces', () => {
    const pentagon = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(4, 0),
      new THREE.Vector2(5, 3),
      new THREE.Vector2(2, 5),
      new THREE.Vector2(-1, 3),
    ];
    expect(PolygonConvexDecomposer.decompose2d(pentagon)).toHaveLength(1);

    const lShape = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(6, 0),
      new THREE.Vector2(6, 2),
      new THREE.Vector2(2, 2),
      new THREE.Vector2(2, 6),
      new THREE.Vector2(0, 6),
    ];
    const pieces = PolygonConvexDecomposer.decompose2d(lShape);
    expect(pieces.length).toBe(2);
    for (const piece of pieces) {
      expect(PolygonConvexDecomposer.isConvexPolygon(piece)).toBe(true);
    }
  });

  it('commits a concave L-shape as grouped convex brushes with re-editable recipe and regenerates cleanly', () => {
    const world = new THREE.Group();
    const model = new SolidModel('World');
    world.add(model.root);
    const stack = new CommandStack(50);
    const committer = new PolygonBrushCommitter({
      commandStack: stack,
      worldObject: world,
      selectObject: () => true,
      selectObjects: () => true,
      activeModelResolve: () => model,
      brushInsertParentResolve: (m) => m.root,
      textureIdResolve: () => null,
      afterWorldMutation: () => {},
    });

    const lShape = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(6, 0),
      new THREE.Vector2(6, 2),
      new THREE.Vector2(2, 2),
      new THREE.Vector2(2, 6),
      new THREE.Vector2(0, 6),
    ];
    const frame = {
      origin: new THREE.Vector3(0, 0, 0),
      axisU: new THREE.Vector3(1, 0, 0),
      axisV: new THREE.Vector3(0, 0, 1),
      axisNormal: new THREE.Vector3(0, 1, 0),
      extrusionMin: 0,
      extrusionMax: 3,
    };
    const recipe = polygonOutlineRecipeFromFrame(lShape, frame);
    const createdMeshes = committer.commitRecipe(recipe);
    expect(createdMeshes).toHaveLength(2);
    const parentGroup = createdMeshes[0]?.parent ?? null;
    expect(parentGroup).not.toBeNull();
    const stored = polygonOutlineRecipeRead(createdMeshes[0] ?? null);
    expect(stored?.points2d).toHaveLength(6);
    expect(stored?.extrusionMax).toBe(3);

    const tallerRecipe = { ...recipe, extrusionMax: 5 };
    if (parentGroup) {
      const updated = committer.regenerateTarget(parentGroup, tallerRecipe);
      expect(updated).toHaveLength(2);
      expect(polygonOutlineRecipeRead(updated[0] ?? null)?.extrusionMax).toBe(5);
    }
  });
});
