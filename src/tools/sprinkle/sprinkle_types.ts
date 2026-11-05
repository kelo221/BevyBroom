import type * as THREE from 'three';

/** Sprinkle placement operation mode matching Hammer++ Entity Sprinkle. */
export type SprinklePlacementMode = 'ADDITIVE' | 'REPLACE' | 'SUBTRACTIVE';

/** Weighted entity or prefab entry in a Sprinkle definition preset. */
export interface SprinkleWeightedEntry {
  /** Catalog entry or prefab identifier. */
  entryId: string;
  /** Relative selection weight (`> 0`). */
  weight: number;
}

/** Configuration parameters for the Hammer++ Sprinkle scatter tool. */
export interface SprinkleConfig {
  /** Scatter disk radius in meters. */
  radius: number;
  /** Number of candidate samples evaluated per scatter stamp. */
  density: number;
  /** Grid spacing along tangent U in meters (`0` for free uniform disk). */
  gridStepX: number;
  /** Grid spacing along tangent V in meters (`0` for free uniform disk). */
  gridStepZ: number;
  /** Placement operation mode. */
  mode: SprinklePlacementMode;
  /** Whether placed objects tilt their +Y axis to match the hit surface normal. */
  alignToNormal: boolean;
  /** Whether placed objects receive a random yaw around their up axis. */
  randomYaw: boolean;
  /** Minimum uniform scale factor. */
  scaleMin: number;
  /** Maximum uniform scale factor. */
  scaleMax: number;
  /** Deterministic PRNG seed. */
  seed: number;
}

/** Surface hit returned by a raycast projection query. */
export interface SprinkleSurfaceHit {
  /** World-space hit position. */
  point: THREE.Vector3;
  /** World-space unit surface normal at the hit. */
  normal: THREE.Vector3;
}

/** One computed scatter placement sample ready to instantiate. */
export interface SprinkleSamplePoint {
  /** Chosen catalog entry or prefab id. */
  entryId: string;
  /** World-space placement position. */
  position: THREE.Vector3;
  /** World-space orientation quaternion. */
  quaternion: THREE.Quaternion;
  /** Uniform scale vector. */
  scale: THREE.Vector3;
}
