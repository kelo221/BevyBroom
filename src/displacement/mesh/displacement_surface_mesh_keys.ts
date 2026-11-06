import type * as THREE from 'three';

/** UserData key carrying the brush face identity of a displacement surface mesh. */
export const DISPLACEMENT_SURFACE_MESH_USERDATA_KEY = 'broomDisplacementMesh';

/** Brush face a displacement surface mesh belongs to. */
export interface DisplacementSurfaceMeshIdentity {
  /** Brush instance id. */
  brushId: string;
  /** Face index on the brush. */
  surfaceIndex: number;
}

/**
 * Returns the brush face identity stored on a displacement surface mesh.
 *
 * @param object Candidate scene object.
 * @returns Identity, or null when the object is no displacement surface mesh.
 */
export function displacementSurfaceMeshIdentityRead(object: THREE.Object3D): DisplacementSurfaceMeshIdentity | null {
  const value = object.userData[DISPLACEMENT_SURFACE_MESH_USERDATA_KEY] as
    Partial<DisplacementSurfaceMeshIdentity> | undefined;
  if (!value || typeof value.brushId !== 'string' || typeof value.surfaceIndex !== 'number') {
    return null;
  }
  return { brushId: value.brushId, surfaceIndex: value.surfaceIndex };
}

/**
 * Returns whether an object is a displacement surface mesh.
 *
 * @param object Candidate scene object.
 * @returns True when the object carries a displacement surface identity.
 */
export function displacementSurfaceMeshIs(object: THREE.Object3D): boolean {
  return displacementSurfaceMeshIdentityRead(object) !== null;
}

/**
 * Builds the scene name of a displacement surface mesh.
 *
 * @param identity Brush face identity.
 * @returns Name of the form `displacement:<brushId>:<surfaceIndex>`.
 */
export function displacementSurfaceMeshNameBuild(identity: DisplacementSurfaceMeshIdentity): string {
  return `displacement:${identity.brushId}:${identity.surfaceIndex}`;
}

/**
 * Lists the displacement surface meshes that are direct children of a solid
 * model root.
 *
 * @param solidRoot Solid model root.
 * @returns Displacement surface meshes in child order.
 */
export function displacementSurfaceMeshesUnder(solidRoot: THREE.Object3D): THREE.Mesh[] {
  return solidRoot.children.filter(
    (child): child is THREE.Mesh => displacementSurfaceMeshIs(child) && (child as THREE.Mesh).isMesh === true,
  );
}

/**
 * Finds the displacement surface mesh of one brush face under a solid root.
 *
 * @param solidRoot Solid model root.
 * @param brushId Brush instance id.
 * @param surfaceIndex Face index.
 * @returns Surface mesh, or null when the face shows none.
 */
export function displacementSurfaceMeshFind(
  solidRoot: THREE.Object3D,
  brushId: string,
  surfaceIndex: number,
): THREE.Mesh | null {
  const found = displacementSurfaceMeshesUnder(solidRoot).find((mesh) => {
    const identity = displacementSurfaceMeshIdentityRead(mesh);
    return identity?.brushId === brushId && identity.surfaceIndex === surfaceIndex;
  });
  return found ?? null;
}
