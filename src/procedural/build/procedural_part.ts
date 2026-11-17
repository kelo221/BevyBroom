import type * as THREE from 'three';

/**
 * One convex piece a procedural generator builds, in the owner's local space:
 * its name, the material slot that textures it and its faces. Every face is a
 * planar convex polygon wound counter-clockwise when seen from outside.
 */
export interface ProceduralPart {
  readonly name: string;
  readonly materialSlot: string;
  readonly faces: readonly (readonly THREE.Vector3[])[];
}
