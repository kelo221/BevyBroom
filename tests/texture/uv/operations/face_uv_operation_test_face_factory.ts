import * as THREE from 'three';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { FaceUvOperationContext } from '@/texture/uv/operations/face_uv_operation_context.js';

/** Deterministic set of face normals covering floors, walls, and slants. */
const TEST_FACE_NORMALS = [
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(1, 1, 1).normalize(),
  new THREE.Vector3(0.3, -0.8, 0.52).normalize(),
];

/** One programmatically built quad face with its UV context. */
export interface FaceUvTestQuadRecipe {
  context: FaceUvOperationContext;
  faceNormal: THREE.Vector3;
  /** Half extent along the first in-plane tangent. */
  halfU: number;
  /** Half extent along the second in-plane tangent. */
  halfV: number;
  /** World center of the quad. */
  worldCenter: THREE.Vector3;
  /** In-plane rotation applied to the quad corners. */
  planeRotationDeg: number;
  /** Seed the recipe was derived from. */
  seed: number;
}

/** Deterministic linear congruential random source for reproducible tests. */
export class FaceUvTestSeedRandom {
  private state: number;

  /**
   * Creates a seeded random source.
   *
   * @param seed Initial state; any integer.
   */
  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * Produces the next value in [0, 1).
   *
   * @returns Pseudo-random unit value.
   */
  nextUnit(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  /**
   * Produces the next value in an inclusive range.
   *
   * @param minimum Range lower bound.
   * @param maximum Range upper bound.
   * @returns Pseudo-random value inside the range.
   */
  nextInRange(minimum: number, maximum: number): number {
    return minimum + this.nextUnit() * (maximum - minimum);
  }

  /**
   * Returns the current generator state for reproducible downstream seeds.
   *
   * @returns Current state value.
   */
  snapshotState(): number {
    return this.state;
  }
}

/**
 * Builds a list of deterministic quad face recipes with varying normals,
 * extents, in-plane rotations, and world positions.
 *
 * @param sampleCount Number of quads to build.
 * @returns Quad recipes with seeded geometry.
 */
export function createSeededQuadRecipes(sampleCount: number): FaceUvTestQuadRecipe[] {
  const random = new FaceUvTestSeedRandom(20261023);
  return Array.from({ length: sampleCount }, (_, index) => {
    const seed = random.snapshotState();
    const recipe = {
      faceNormal: TEST_FACE_NORMALS[index % TEST_FACE_NORMALS.length] as THREE.Vector3,
      halfU: random.nextInRange(0.5, 3),
      halfV: random.nextInRange(0.5, 3),
      worldCenter: new THREE.Vector3(random.nextInRange(-4, 4), random.nextInRange(-4, 4), random.nextInRange(-4, 4)),
      planeRotationDeg: random.nextInRange(-85, 85),
      seed,
    };
    return buildQuadRecipe(recipe);
  });
}

/**
 * Assembles one quad recipe into a UV context.
 *
 * @param parts Seeded geometry parts.
 * @returns Completed recipe with vertices and context.
 */
function buildQuadRecipe(parts: Omit<FaceUvTestQuadRecipe, 'context'>): FaceUvTestQuadRecipe {
  const vertices = createQuadVerticesOnPlane(
    parts.faceNormal,
    parts.halfU,
    parts.halfV,
    parts.planeRotationDeg,
    parts.worldCenter,
  );
  return { ...parts, context: new FaceUvOperationContext({ vertices, faceNormal: parts.faceNormal }) };
}

/**
 * Creates quad vertices lying in the plane of a normal, wound counter-
 * clockwise around it, with an in-plane rotation.
 *
 * @param faceNormal Unit plane normal.
 * @param halfU Half extent along the first tangent.
 * @param halfV Half extent along the second tangent.
 * @param planeRotationDeg Rotation of the corners around the normal.
 * @param worldCenter Quad center in world space.
 * @returns Four vertices in winding order.
 */
export function createQuadVerticesOnPlane(
  faceNormal: THREE.Vector3,
  halfU: number,
  halfV: number,
  planeRotationDeg: number,
  worldCenter: THREE.Vector3,
): THREE.Vector3[] {
  const tangentU = createPlaneTangent(faceNormal, 0);
  const tangentV = new THREE.Vector3().crossVectors(faceNormal, tangentU).normalize();
  const rotation = new THREE.Quaternion().setFromAxisAngle(faceNormal, THREE.MathUtils.degToRad(planeRotationDeg));
  tangentU.applyQuaternion(rotation);
  tangentV.applyQuaternion(rotation);
  return [
    cornerFromTangents(worldCenter, tangentU, tangentV, -halfU, -halfV),
    cornerFromTangents(worldCenter, tangentU, tangentV, halfU, -halfV),
    cornerFromTangents(worldCenter, tangentU, tangentV, halfU, halfV),
    cornerFromTangents(worldCenter, tangentU, tangentV, -halfU, halfV),
  ];
}

/**
 * Combines two plane tangents into one world-space corner.
 *
 * @param worldCenter Quad center.
 * @param tangentU First in-plane tangent.
 * @param tangentV Second in-plane tangent.
 * @param scaleU Tangent U multiplier.
 * @param scaleV Tangent V multiplier.
 * @returns Corner position.
 */
function cornerFromTangents(
  worldCenter: THREE.Vector3,
  tangentU: THREE.Vector3,
  tangentV: THREE.Vector3,
  scaleU: number,
  scaleV: number,
): THREE.Vector3 {
  return worldCenter.clone().addScaledVector(tangentU, scaleU).addScaledVector(tangentV, scaleV);
}

/**
 * Creates a unit tangent of a plane that is perpendicular to its normal.
 *
 * @param faceNormal Unit plane normal.
 * @param index Variant index choosing the seed axis.
 * @returns Unit in-plane tangent.
 */
function createPlaneTangent(faceNormal: THREE.Vector3, index: number): THREE.Vector3 {
  const seedAxes = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)];
  const seedAxis = seedAxes[index % seedAxes.length] as THREE.Vector3;
  const candidate = new THREE.Vector3().crossVectors(seedAxis, faceNormal);
  if (candidate.lengthSq() < 1e-8) {
    return createPlaneTangent(faceNormal, index + 1);
  }
  return candidate.normalize();
}

/**
 * Builds a deterministic UV matrix in a face's plane from a seed: seeded
 * translation, rotation, and signed scales.
 *
 * @param seed Seed driving the parameters.
 * @param faceNormal Plane normal of the face.
 * @returns UV matrix in the face plane.
 */
export function createSeededFaceUvMatrix(seed: number, faceNormal: THREE.Vector3): SurfaceUvMatrix {
  const random = new FaceUvTestSeedRandom(seed);
  return SurfaceUvMatrix.fromTrs(
    new THREE.Vector2(random.nextInRange(-2, 2), random.nextInRange(-2, 2)),
    faceNormal,
    random.nextInRange(-85, 85),
    random.nextInRange(0.3, 3) * (random.nextUnit() < 0.5 ? -1 : 1),
    random.nextInRange(0.3, 3) * (random.nextUnit() < 0.5 ? -1 : 1),
  );
}
