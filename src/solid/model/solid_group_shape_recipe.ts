import * as THREE from 'three';

/** UserData key holding the shape recipe of a drawn shape group. */
export const SOLID_GROUP_SHAPE_RECIPE_USERDATA_KEY = 'shapeDrawShape';

/** Everything needed to rebuild a drawn shape group in place. */
export interface SolidGroupShapeRecipe {
  /** Shape identifier. */
  shapeId: string;
  /** Parameter values keyed by parameter id. */
  parameters: Record<string, number | string>;
  /** Model-local minimum corner of the bounds the shape was drawn into. */
  boundsMin: [number, number, number];
  /** Model-local maximum corner of the bounds the shape was drawn into. */
  boundsMax: [number, number, number];
  /** Model-local orientation of the shape axes (x, y, z, w). */
  orientation: [number, number, number, number];
  /** Axis pointing up in the shape frame. */
  upAxis: 'x' | 'y' | 'z';
}

/**
 * Stores the shape recipe on a group.
 *
 * @param group Group created by a shape draw tool.
 * @param recipe Recipe to store.
 */
export function solidGroupShapeRecipeWrite(group: THREE.Group, recipe: SolidGroupShapeRecipe): void {
  group.userData[SOLID_GROUP_SHAPE_RECIPE_USERDATA_KEY] = recipe;
}

/**
 * Reads the shape recipe of a group.
 *
 * @param group Candidate group.
 * @returns Recipe, or null when the group was not created by a shape draw tool.
 */
export function solidGroupShapeRecipeRead(group: THREE.Object3D): SolidGroupShapeRecipe | null {
  const recipe = group.userData[SOLID_GROUP_SHAPE_RECIPE_USERDATA_KEY];
  return solidGroupShapeRecipeIsValid(recipe) ? recipe : null;
}

/**
 * Returns whether a value is a readable shape recipe.
 *
 * @param recipe Candidate read from userData.
 * @returns True when every member is present.
 */
function solidGroupShapeRecipeIsValid(recipe: unknown): recipe is SolidGroupShapeRecipe {
  if (recipe === null || typeof recipe !== 'object') {
    return false;
  }
  const candidate = recipe as Partial<SolidGroupShapeRecipe>;
  return (
    typeof candidate.shapeId === 'string' &&
    typeof candidate.parameters === 'object' &&
    Array.isArray(candidate.boundsMin) &&
    Array.isArray(candidate.boundsMax) &&
    Array.isArray(candidate.orientation) &&
    (candidate.upAxis === 'x' || candidate.upAxis === 'y' || candidate.upAxis === 'z')
  );
}
