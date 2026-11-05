import * as THREE from 'three';
import type { PolygonExtrusionFrame } from './polygon_convex_decomposer.js';

/**
 * UserData key storing the re-editable 2D Polygon outline recipe on a brush or
 * group.
 */
export const USERDATA_POLYGON_OUTLINE_KEY = 'broomPolygonOutline';

/** Serializable re-editable 2D polygon extrusion recipe. */
export interface PolygonOutlineRecipe {
  /** 2D outline vertices in the sketching plane `[u, v]`. */
  points2d: [number, number][];
  /** World-space origin of the 2D plane. */
  origin: [number, number, number];
  /** Unit vector along the 2D U axis. */
  axisU: [number, number, number];
  /** Unit vector along the 2D V axis. */
  axisV: [number, number, number];
  /** Unit normal vector along which the polygon is extruded. */
  axisNormal: [number, number, number];
  /** Minimum extrusion offset along `axisNormal`. */
  extrusionMin: number;
  /** Maximum extrusion offset along `axisNormal`. */
  extrusionMax: number;
}

/**
 * Writes a re-editable 2D polygon outline recipe onto a brush or group object.
 *
 * @param object Target brush mesh or CSG group.
 * @param recipe Polygon outline recipe to store.
 */
export function polygonOutlineRecipeWrite(object: THREE.Object3D, recipe: PolygonOutlineRecipe): void {
  object.userData[USERDATA_POLYGON_OUTLINE_KEY] = {
    points2d: recipe.points2d.map(([u, v]) => [u, v] as [number, number]),
    origin: [...recipe.origin] as [number, number, number],
    axisU: [...recipe.axisU] as [number, number, number],
    axisV: [...recipe.axisV] as [number, number, number],
    axisNormal: [...recipe.axisNormal] as [number, number, number],
    extrusionMin: recipe.extrusionMin,
    extrusionMax: recipe.extrusionMax,
  };
}

/**
 * Reads the re-editable 2D polygon outline recipe from an object or its nearest
 * ancestor group.
 *
 * @param object Candidate object.
 * @returns Stored recipe, or null when not created by the Polygon tool.
 */
export function polygonOutlineRecipeRead(object: THREE.Object3D | null): PolygonOutlineRecipe | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const raw = current.userData?.[USERDATA_POLYGON_OUTLINE_KEY];
    if (polygonOutlineRecipeIsValid(raw)) {
      return raw;
    }
    current = current.parent;
  }
  return null;
}

/**
 * Converts a `PolygonOutlineRecipe` into 2D `THREE.Vector2` points and a
 * `PolygonExtrusionFrame`.
 *
 * @param recipe Stored polygon outline recipe.
 * @returns Outline points and extrusion frame.
 */
export function polygonOutlineRecipeToFrame(recipe: PolygonOutlineRecipe): {
  outline: THREE.Vector2[];
  frame: PolygonExtrusionFrame;
} {
  return {
    outline: recipe.points2d.map(([u, v]) => new THREE.Vector2(u, v)),
    frame: {
      origin: new THREE.Vector3(...recipe.origin),
      axisU: new THREE.Vector3(...recipe.axisU),
      axisV: new THREE.Vector3(...recipe.axisV),
      axisNormal: new THREE.Vector3(...recipe.axisNormal),
      extrusionMin: recipe.extrusionMin,
      extrusionMax: recipe.extrusionMax,
    },
  };
}

/**
 * Builds a `PolygonOutlineRecipe` from 2D vertices and an extrusion frame.
 *
 * @param outline 2D polygon vertices.
 * @param frame Extrusion plane and depth range.
 * @returns Serializable polygon outline recipe.
 */
export function polygonOutlineRecipeFromFrame(
  outline: readonly THREE.Vector2[],
  frame: PolygonExtrusionFrame,
): PolygonOutlineRecipe {
  return {
    points2d: outline.map((pt) => [pt.x, pt.y]),
    origin: [frame.origin.x, frame.origin.y, frame.origin.z],
    axisU: [frame.axisU.x, frame.axisU.y, frame.axisU.z],
    axisV: [frame.axisV.x, frame.axisV.y, frame.axisV.z],
    axisNormal: [frame.axisNormal.x, frame.axisNormal.y, frame.axisNormal.z],
    extrusionMin: frame.extrusionMin,
    extrusionMax: frame.extrusionMax,
  };
}

/**
 * Validates an untrusted value as a `PolygonOutlineRecipe`.
 *
 * @param candidate Raw userData value.
 * @returns True when valid.
 */
function polygonOutlineRecipeIsValid(candidate: unknown): candidate is PolygonOutlineRecipe {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }
  const rec = candidate as Partial<PolygonOutlineRecipe>;
  return (
    Array.isArray(rec.points2d) &&
    rec.points2d.length >= 3 &&
    Array.isArray(rec.origin) &&
    Array.isArray(rec.axisU) &&
    Array.isArray(rec.axisV) &&
    Array.isArray(rec.axisNormal) &&
    typeof rec.extrusionMin === 'number' &&
    typeof rec.extrusionMax === 'number'
  );
}
