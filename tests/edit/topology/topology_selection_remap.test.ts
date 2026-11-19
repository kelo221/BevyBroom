import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildComponentEdgeKey } from '@/edit/component/component_selection_entry.js';
import { topologySelectionCornersCapture, topologySelectionRemap } from '@/edit/topology/topology_selection_remap.js';
import type { TopologyWorkingGeometry } from '@/edit/topology/topology_working_geometry.js';

/**
 * Builds working geometry from positions and face loops.
 *
 * @param positions Corner positions.
 * @param faces Face loops.
 * @returns Working geometry.
 */
function geometryCreate(positions: THREE.Vector3[], faces: number[][]): TopologyWorkingGeometry {
  return {
    positions,
    faces: faces.map((vertexIndices) => ({
      vertexIndices,
      cornerUvs: vertexIndices.map(() => ({ u: 0, v: 0 })),
      textureId: '',
    })),
  };
}

/** Unit square corners in the ground plane. */
const SQUARE = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(1, 0, 1),
  new THREE.Vector3(0, 0, 1),
];

/** Proves a selection survives a rebuild that reorders corners and splits faces. */
describe('topologySelectionRemap', () => {
  it('finds vertices and edges again by their corner positions after reordering', () => {
    const before = new Map([
      [
        't',
        geometryCreate(
          SQUARE.map((corner) => corner.clone()),
          [[0, 1, 2, 3]],
        ),
      ],
    ]);
    const selected = [
      { targetId: 't', kind: 'vertex' as const, componentKey: '1' },
      { targetId: 't', kind: 'edge' as const, componentKey: buildComponentEdgeKey(2, 3) },
    ];
    const captured = topologySelectionCornersCapture(selected, before);
    const reversed = SQUARE.slice()
      .reverse()
      .map((corner) => corner.clone());
    const after = new Map([['t', geometryCreate(reversed, [[0, 1, 2, 3]])]]);
    const remapped = topologySelectionRemap(captured, after);
    expect(remapped).toEqual([
      { targetId: 't', kind: 'vertex', componentKey: '2' },
      { targetId: 't', kind: 'edge', componentKey: buildComponentEdgeKey(0, 1) },
    ]);
  });

  it('selects every part of a face that was split in two', () => {
    const before = new Map([
      [
        't',
        geometryCreate(
          SQUARE.map((corner) => corner.clone()),
          [[0, 1, 2, 3]],
        ),
      ],
    ]);
    const captured = topologySelectionCornersCapture([{ targetId: 't', kind: 'face', componentKey: '0' }], before);
    const after = new Map([
      [
        't',
        geometryCreate(
          [...SQUARE.map((corner) => corner.clone()), new THREE.Vector3(0, -1, 0)],
          [
            [0, 1, 2],
            [0, 2, 3],
            [0, 4, 1],
          ],
        ),
      ],
    ]);
    expect(topologySelectionRemap(captured, after).map((entry) => entry.componentKey)).toEqual(['0', '1']);
  });

  it('drops a component whose corners are gone', () => {
    const before = new Map([
      [
        't',
        geometryCreate(
          SQUARE.map((corner) => corner.clone()),
          [[0, 1, 2, 3]],
        ),
      ],
    ]);
    const captured = topologySelectionCornersCapture([{ targetId: 't', kind: 'vertex', componentKey: '0' }], before);
    const after = new Map([['t', geometryCreate([new THREE.Vector3(5, 5, 5)], [])]]);
    expect(topologySelectionRemap(captured, after)).toEqual([]);
  });
});
