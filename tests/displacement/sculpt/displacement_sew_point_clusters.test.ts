import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DisplacementSewPointClusters } from '@/displacement/sculpt/displacement_sew_point_clusters.js';

/** Tolerance-based grouping of sew positions. */
describe('DisplacementSewPointClusters', () => {
  it('groups positions within the tolerance even across cell borders and keeps distant ones apart', () => {
    const tolerance = 1e-3;
    const clusters = new DisplacementSewPointClusters<string>(tolerance);
    const onCellBorder = new THREE.Vector3(tolerance * 7, -tolerance * 3, tolerance * 11);
    clusters.add(onCellBorder.clone().addScalar(-tolerance * 0.2), 'first');
    clusters.add(onCellBorder.clone().addScalar(tolerance * 0.2), 'second');
    clusters.add(onCellBorder.clone().addScalar(tolerance * 5), 'distant');
    expect(clusters.groupsRead()).toEqual([['first', 'second'], ['distant']]);
  });

  it('joins the nearest cluster when two are within the tolerance', () => {
    const tolerance = 1e-2;
    const clusters = new DisplacementSewPointClusters<string>(tolerance);
    const origin = new THREE.Vector3(2, 3, -4);
    clusters.add(origin, 'left');
    clusters.add(origin.clone().add(new THREE.Vector3(tolerance * 1.5, 0, 0)), 'right');
    clusters.add(origin.clone().add(new THREE.Vector3(tolerance * 0.9, 0, 0)), 'probe');
    expect(clusters.groupsRead()).toEqual([['left'], ['right', 'probe']]);
  });
});
