import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  buildClipPiecePreviews,
  CLIP_PIECE_ROLE_USERDATA_KEY,
  type ClipPieceRole,
} from '@/tools/clip_plane/clip_plane_half_preview.js';
import { ClipKeepMode } from '@/tools/clip_plane/clip_keep_mode.js';
import { Theme } from '@/theme.js';

/**
 * Creates a box mesh centered at the origin.
 *
 * @returns Mesh ready for clip piece previews.
 */
function createBox(): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  mesh.updateMatrixWorld(true);
  return mesh;
}

/**
 * Returns the smallest and largest signed distance of a mesh's vertices to a
 * plane.
 *
 * @param mesh Piece preview mesh (world-space positions).
 * @param plane Clip plane.
 * @returns Distance range.
 */
function sideRange(mesh: THREE.Mesh, plane: THREE.Plane): { min: number; max: number } {
  const positions = mesh.geometry.getAttribute('position');
  const vertex = new THREE.Vector3();
  let min = Infinity;
  let max = -Infinity;
  for (let index = 0; index < positions.count; index++) {
    const distance = plane.distanceToPoint(vertex.fromBufferAttribute(positions, index));
    min = Math.min(min, distance);
    max = Math.max(max, distance);
  }
  return { min, max };
}

/**
 * Finds the piece preview with a role.
 *
 * @param pieces Piece previews.
 * @param role Wanted role.
 * @returns Piece mesh, or undefined.
 */
function pieceWithRole(pieces: THREE.Mesh[], role: ClipPieceRole): THREE.Mesh | undefined {
  return pieces.find((piece) => piece.userData[CLIP_PIECE_ROLE_USERDATA_KEY] === role);
}

describe('buildClipPiecePreviews', () => {
  const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);

  it('shows only the removed piece, behind the plane, in red for Side A', () => {
    const pieces = buildClipPiecePreviews(createBox(), plane, ClipKeepMode.SIDE_A);
    expect(pieces).toHaveLength(1);
    const discard = pieceWithRole(pieces, 'discard');
    expect(discard).toBeDefined();
    expect(sideRange(discard ?? pieces[0]!, plane).max).toBeLessThanOrEqual(1e-6);
    expect(((discard ?? pieces[0]!).material as THREE.MeshBasicMaterial).color.getHex()).toBe(Theme.clipDiscardColor);
  });

  it('shows the removed piece in front of the plane for Side B', () => {
    const pieces = buildClipPiecePreviews(createBox(), plane, ClipKeepMode.SIDE_B);
    const discard = pieceWithRole(pieces, 'discard');
    expect(discard).toBeDefined();
    expect(sideRange(discard ?? pieces[0]!, plane).min).toBeGreaterThanOrEqual(-1e-6);
  });

  it('shows both kept pieces in two colors, one on each side, for Both', () => {
    const pieces = buildClipPiecePreviews(createBox(), plane, ClipKeepMode.BOTH);
    const first = pieceWithRole(pieces, 'keep_first');
    const second = pieceWithRole(pieces, 'keep_second');
    expect(first && second).toBeTruthy();
    expect(sideRange(first ?? pieces[0]!, plane).min).toBeGreaterThanOrEqual(-1e-6);
    expect(sideRange(second ?? pieces[0]!, plane).max).toBeLessThanOrEqual(1e-6);
    const firstColor = ((first ?? pieces[0]!).material as THREE.MeshBasicMaterial).color.getHex();
    const secondColor = ((second ?? pieces[0]!).material as THREE.MeshBasicMaterial).color.getHex();
    expect([firstColor, secondColor]).toEqual([Theme.clipKeepColor, Theme.clipKeepSecondColor]);
  });

  it('never writes depth and wins against coplanar brush faces', () => {
    const pieces = buildClipPiecePreviews(createBox(), plane, ClipKeepMode.BOTH);
    pieces.forEach((piece) => {
      const material = piece.material as THREE.MeshBasicMaterial;
      expect(material.depthWrite).toBe(false);
      expect(material.transparent).toBe(true);
      expect(material.polygonOffset).toBe(true);
      expect(material.polygonOffsetUnits).toBeLessThan(0);
    });
  });

  it('is depth-tested in perspective panes and drawn on top in orthographic panes', () => {
    const [piece] = buildClipPiecePreviews(createBox(), plane, ClipKeepMode.SIDE_A);
    expect(piece).toBeDefined();
    const material = piece!.material as THREE.MeshBasicMaterial;
    const renderer = {} as THREE.WebGLRenderer;
    const scene = new THREE.Scene();
    piece!.onBeforeRender(renderer, scene, new THREE.PerspectiveCamera(), piece!.geometry, material, null as never);
    expect(material.depthTest).toBe(true);
    piece!.onBeforeRender(renderer, scene, new THREE.OrthographicCamera(), piece!.geometry, material, null as never);
    expect(material.depthTest).toBe(false);
  });

  it('shows the whole mesh as removed when the kept side is empty', () => {
    const missPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(20, 0, 0),
    );
    const pieces = buildClipPiecePreviews(createBox(), missPlane, ClipKeepMode.SIDE_A);
    expect(pieces).toHaveLength(1);
    expect(pieceWithRole(pieces, 'discard')).toBeDefined();
  });
});
