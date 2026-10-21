import * as THREE from 'three';
import type { McpBounds, McpVec3 } from '@/ai/shared/mcp_protocol_types.js';

/**
 * Converts a Three.js vector into a plain MCP DTO.
 *
 * @param vector Source vector.
 * @returns Plain {x,y,z} object.
 */
export function vec3ToDto(vector: THREE.Vector3): McpVec3 {
  return { x: vector.x, y: vector.y, z: vector.z };
}

/**
 * Builds a Three.js vector from an MCP DTO.
 *
 * @param dto Plain vector or undefined.
 * @param fallback Default when dto is missing.
 * @returns Cloned vector.
 */
export function dtoToVec3(dto: McpVec3 | undefined, fallback: THREE.Vector3): THREE.Vector3 {
  if (!dto) return fallback.clone();
  return new THREE.Vector3(dto.x, dto.y, dto.z);
}

/**
 * Converts a box into an MCP bounds DTO.
 *
 * @param box Source box.
 * @returns Bounds DTO or null when empty.
 */
export function boxToDto(box: THREE.Box3): McpBounds | null {
  if (box.isEmpty()) return null;
  return { min: vec3ToDto(box.min), max: vec3ToDto(box.max) };
}

/**
 * Builds a box from an MCP bounds DTO.
 *
 * @param bounds Bounds DTO.
 * @returns Three.js box.
 */
export function dtoToBox(bounds: McpBounds): THREE.Box3 {
  return new THREE.Box3(
    new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
    new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
  );
}

/**
 * Returns the center of a bounds DTO.
 *
 * @param bounds Bounds to sample.
 * @returns Center point.
 */
export function boundsCenter(bounds: McpBounds): THREE.Vector3 {
  return new THREE.Vector3(
    (bounds.min.x + bounds.max.x) * 0.5,
    (bounds.min.y + bounds.max.y) * 0.5,
    (bounds.min.z + bounds.max.z) * 0.5,
  );
}

/**
 * Squared distance between two points (avoids sqrt when comparing).
 *
 * @param a First point.
 * @param b Second point.
 * @returns Squared Euclidean distance.
 */
export function distanceSquared(a: THREE.Vector3, b: THREE.Vector3): number {
  return a.distanceToSquared(b);
}
