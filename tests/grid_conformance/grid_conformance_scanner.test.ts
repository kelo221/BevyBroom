import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GridConformanceScanner } from '@/grid_conformance/grid_conformance_scanner.js';
import {
  gridConformanceBoundsOnGrid,
  gridConformanceValueOnGrid,
} from '@/grid_conformance/grid_conformance_point_check.js';
import { GRID_INTERVAL_MINIMUM } from '@/types/snap_presets.js';
import { GRID_TEST_OFF_GRID_OFFSET, gridTestBrushAdd, gridTestMeshAdd } from './grid_conformance_test_scene.js';

/**
 * Proves the grid checks accept grid-aligned geometry and catch geometry off
 * the minimum grid.
 */
describe('GridConformanceScanner', () => {
  it('accepts values on the minimum grid and rejects values between grid lines', () => {
    expect(gridConformanceValueOnGrid(GRID_INTERVAL_MINIMUM * 37)).toBe(true);
    expect(gridConformanceValueOnGrid(-GRID_INTERVAL_MINIMUM * 5)).toBe(true);
    expect(gridConformanceValueOnGrid(GRID_INTERVAL_MINIMUM * 5 + GRID_TEST_OFF_GRID_OFFSET)).toBe(false);
  });

  it('accepts bounds centered on a grid line whose ends are off the grid', () => {
    const halfExtent = GRID_INTERVAL_MINIMUM * 3 + GRID_TEST_OFF_GRID_OFFSET;
    const centered = new THREE.Box3(new THREE.Vector3(-halfExtent, 0, 0), new THREE.Vector3(halfExtent, 1, 1));
    expect(gridConformanceBoundsOnGrid(centered)).toBe(true);
    const shifted = centered.clone().translate(new THREE.Vector3(GRID_TEST_OFF_GRID_OFFSET, 0, 0));
    expect(gridConformanceBoundsOnGrid(shifted)).toBe(false);
  });

  it('reports nothing for a brush placed and sized on the grid', () => {
    const world = new THREE.Group();
    gridTestBrushAdd(world, new THREE.Vector3(1, 0.5, -2), new THREE.Vector3(2, 1, 0.5));
    expect(new GridConformanceScanner().violationsCollect(world)).toEqual([]);
  });

  it('reports a brush moved off the grid by its id', () => {
    const world = new THREE.Group();
    const { brush } = gridTestBrushAdd(
      world,
      new THREE.Vector3(1 + GRID_TEST_OFF_GRID_OFFSET, 0.5, 0),
      new THREE.Vector3(1, 1, 1),
    );
    const violations = new GridConformanceScanner().violationsCollect(world);
    expect(violations.map((violation) => [violation.kind, violation.key])).toEqual([['brush', brush.id]]);
  });

  it('reports a brush starting on the grid whose size leaves the grid', () => {
    const world = new THREE.Group();
    const width = 1 + GRID_TEST_OFF_GRID_OFFSET;
    gridTestBrushAdd(world, new THREE.Vector3(width / 2, 0, 0), new THREE.Vector3(width, 1, 1));
    expect(new GridConformanceScanner().violationsCollect(world)).toHaveLength(1);
  });

  it('reports an editable mesh off the grid and lists every editable mesh', () => {
    const world = new THREE.Group();
    const onGrid = gridTestMeshAdd(world, new THREE.Vector3(0.5, 0.5, 0.5));
    const offGrid = gridTestMeshAdd(world, new THREE.Vector3(GRID_TEST_OFF_GRID_OFFSET, 0, 0));
    const scanner = new GridConformanceScanner();
    expect(scanner.violationsCollect(world).map((violation) => [violation.kind, violation.key])).toEqual([
      ['mesh', offGrid.uuid],
    ]);
    expect(scanner.meshObjectsList(world).map((mesh) => mesh.objectUuid)).toEqual([onGrid.uuid, offGrid.uuid]);
  });

  it('does not list solid brush meshes as editable meshes', () => {
    const world = new THREE.Group();
    gridTestBrushAdd(world, new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1));
    expect(new GridConformanceScanner().meshObjectsList(world)).toEqual([]);
  });
});
