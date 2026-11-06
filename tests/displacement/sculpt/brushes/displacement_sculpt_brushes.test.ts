import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DISPLACEMENT_ALPHA_MAX } from '@/displacement/model/displacement_types.js';
import { DisplacementSurfacePlacement } from '@/displacement/grid/displacement_surface_placement.js';
import { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import { DisplacementSculptOps } from '@/displacement/sculpt/displacement_sculpt_ops.js';
import type { DisplacementSculptDab } from '@/displacement/sculpt/brushes/displacement_sculpt_brush.js';
import { DisplacementSculptBrushRaiseLower } from '@/displacement/sculpt/brushes/displacement_sculpt_brush_raise_lower.js';
import { DisplacementSculptBrushRaiseTo } from '@/displacement/sculpt/brushes/displacement_sculpt_brush_raise_to.js';
import { DisplacementSculptBrushAlpha } from '@/displacement/sculpt/brushes/displacement_sculpt_brush_alpha.js';
import { displacementSculptBrushCreate } from '@/displacement/sculpt/brushes/displacement_sculpt_brush_factory.js';
import {
  displacementSculptFalloffCosine,
  displacementSculptFalloffHard,
} from '@/displacement/sculpt/brushes/displacement_sculpt_weights.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestTarget,
} from '../../displacement_test_rig.js';

/** Edge lengths of the test boxes. */
const BRUSHES_TEST_BOX_EDGES = new THREE.Vector3(4, 2, 4);

/** World center of the first test box. */
const BRUSHES_TEST_BOX_CENTER = new THREE.Vector3(-2, 1, 3);

/**
 * Builds displaced faces of one box: the face pointing along each direction.
 *
 * @param directions Outward directions of the wanted faces.
 * @returns Sculpt faces in the order of the directions.
 */
function brushesTestFacesCreate(directions: readonly THREE.Vector3[]): DisplacementSculptFace[] {
  const rig = displacementTestRigCreate('BrushesTest');
  const brush = displacementTestBoxAdd(rig, BRUSHES_TEST_BOX_EDGES, BRUSHES_TEST_BOX_CENTER);
  return directions.map((direction) => {
    const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, direction));
    displacementTestCreate(rig, target, 3);
    const face = DisplacementSculptFace.fromTarget(target);
    if (!face) throw new Error('face has no displacement');
    return face;
  });
}

/**
 * Builds the displaced top face of the test box.
 *
 * @returns Sculpt face pointing up.
 */
function brushesTestTopFaceCreate(): DisplacementSculptFace {
  const [face] = brushesTestFacesCreate([new THREE.Vector3(0, 1, 0)]);
  if (!face) throw new Error('top face missing');
  return face;
}

/**
 * Returns the world center of a face's flat grid.
 *
 * @param face Sculpt face.
 * @returns World center.
 */
function brushesTestFaceCenter(face: DisplacementSculptFace): THREE.Vector3 {
  const sum = face.placement.basePositions.reduce((total, point) => total.add(point), new THREE.Vector3());
  return sum.multiplyScalar(1 / face.placement.basePositions.length);
}

/**
 * Returns the world spacing between neighboring grid vertices of a face.
 *
 * @param face Sculpt face.
 * @returns Distance between the first two vertices.
 */
function brushesTestGridSpacing(face: DisplacementSculptFace): number {
  const [first, second] = face.placement.basePositions;
  if (!first || !second) throw new Error('grid too small');
  return first.distanceTo(second);
}

/**
 * Builds a dab centered on a face with some fields replaced.
 *
 * @param face Face the dab is centered on.
 * @param overrides Dab fields to replace.
 * @returns Soft, spatial, raising face-normal dab with the overrides applied.
 */
function brushesTestDab(
  face: DisplacementSculptFace,
  overrides: Partial<DisplacementSculptDab>,
): DisplacementSculptDab {
  return {
    center: brushesTestFaceCenter(face),
    radius: brushesTestGridSpacing(face) * 2.3,
    distance: 0.2,
    direction: 1,
    edge: 'soft',
    spatial: true,
    axis: null,
    alphaValue: DISPLACEMENT_ALPHA_MAX,
    ...overrides,
  };
}

/**
 * Lists the flat-grid distance of every vertex to a point.
 *
 * @param face Sculpt face.
 * @param point World point.
 * @returns Row-major distances.
 */
function brushesTestBaseDistances(face: DisplacementSculptFace, point: THREE.Vector3): number[] {
  return face.placement.basePositions.map((base) => base.distanceTo(point));
}

/** Paint brush falloff, spatial mode, axes, Raise To and Paint Alpha. */
describe('displacement sculpt brushes', () => {
  it('gives every vertex inside the radius full weight with a hard edge and eases with a soft edge', () => {
    const hardFace = brushesTestTopFaceCreate();
    const softFace = brushesTestTopFaceCreate();
    const hardDab = brushesTestDab(hardFace, { edge: 'hard' });
    expect(new DisplacementSculptBrushRaiseLower().dabApply(hardFace, hardDab)).toBe(true);
    new DisplacementSculptBrushRaiseLower().dabApply(softFace, brushesTestDab(softFace, { edge: 'soft' }));
    const distances = brushesTestBaseDistances(hardFace, hardDab.center);
    distances.forEach((distance, vertexIndex) => {
      const inside = distance <= hardDab.radius;
      expect(hardFace.displacement.offsets[vertexIndex]).toBeCloseTo(inside ? hardDab.distance : 0, 9);
      const softOffset = softFace.displacement.offsets[vertexIndex] ?? Number.NaN;
      expect(softOffset).toBeLessThanOrEqual(hardFace.displacement.offsets[vertexIndex] ?? Number.NaN);
    });
    expect(distances.some((distance) => distance > 0 && distance < hardDab.radius)).toBe(true);
    expect(displacementSculptFalloffHard(hardDab.radius * 0.99, hardDab.radius)).toBe(1);
    expect(displacementSculptFalloffCosine(hardDab.radius * 0.5, hardDab.radius)).toBeCloseTo(0.5, 9);
  });

  it('moves exactly the vertex nearest the center when spatial is off, on the nearest face only', () => {
    const [topFace, sideFace] = brushesTestFacesCreate([new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)]);
    if (!topFace || !sideFace) throw new Error('faces missing');
    const spacing = brushesTestGridSpacing(topFace);
    const center = brushesTestFaceCenter(topFace).add(new THREE.Vector3(spacing * 0.3, 0.05, -spacing * 0.2));
    const dab = brushesTestDab(topFace, { center, spatial: false, radius: spacing * 50 });
    const changed = DisplacementSculptOps.paintDab([sideFace, topFace], dab, new DisplacementSculptBrushRaiseLower());
    expect(changed).toEqual([topFace]);
    const movedIndices = topFace.displacement.offsets.flatMap((offset, index) => (offset !== 0 ? [index] : []));
    expect(movedIndices).toHaveLength(1);
    const distances = brushesTestBaseDistances(topFace, center);
    expect(movedIndices[0]).toBe(distances.indexOf(Math.min(...distances)));
    expect(sideFace.displacement.offsets.every((offset) => offset === 0)).toBe(true);
  });

  it('raises vertices to the target height without overshooting and leaves vertices already there', () => {
    const face = brushesTestTopFaceCreate();
    const brush = new DisplacementSculptBrushRaiseTo();
    const softDab = brushesTestDab(face, { distance: 0.6 });
    for (let dab = 0; dab < 5; dab++) brush.dabApply(face, softDab);
    face.displacement.offsets.forEach((_offset, vertexIndex) => {
      expect(DisplacementSurfacePlacement.heightRead(face.displacement, vertexIndex)).toBeLessThanOrEqual(0.6 + 1e-9);
    });
    const hardDab = brushesTestDab(face, { distance: 0.6, edge: 'hard' });
    expect(brush.dabApply(face, hardDab)).toBe(true);
    const insideIndices = brushesTestBaseDistances(face, hardDab.center).flatMap((distance, index) =>
      distance <= hardDab.radius ? [index] : [],
    );
    insideIndices.forEach((vertexIndex) => {
      expect(DisplacementSurfacePlacement.heightRead(face.displacement, vertexIndex)).toBeCloseTo(0.6, 9);
    });
    const settled = face.displacement.offsets.slice();
    expect(brush.dabApply(face, hardDab)).toBe(false);
    expect(face.displacement.offsets).toEqual(settled);
  });

  it('raises to a world coordinate along a world axis', () => {
    const face = brushesTestTopFaceCreate();
    const targetY = brushesTestFaceCenter(face).y + 0.35;
    const dab = brushesTestDab(face, { distance: targetY, edge: 'hard', axis: new THREE.Vector3(0, 1, 0) });
    new DisplacementSculptBrushRaiseTo().dabApply(face, dab);
    const position = new THREE.Vector3();
    brushesTestBaseDistances(face, dab.center).forEach((distance, vertexIndex) => {
      if (distance > dab.radius) return;
      expect(face.placement.displacedPositionWrite(face.displacement, vertexIndex, position).y).toBeCloseTo(targetY, 9);
    });
  });

  it('projects raise and raise to onto the face normal, moving nothing for a perpendicular axis', () => {
    const face = brushesTestTopFaceCreate();
    const perpendicular = new THREE.Vector3()
      .crossVectors(face.placement.normal, new THREE.Vector3(1, 2, 3))
      .normalize();
    expect(face.axisFactorRead(perpendicular)).toBeCloseTo(0, 9);
    const sideways = brushesTestDab(face, { axis: perpendicular, edge: 'hard' });
    expect(new DisplacementSculptBrushRaiseLower().dabApply(face, sideways)).toBe(false);
    expect(new DisplacementSculptBrushRaiseTo().dabApply(face, { ...sideways, distance: 5 })).toBe(false);
    expect(face.displacement.offsets.every((offset) => offset === 0)).toBe(true);
    const tilted = face.placement.normal.clone().add(perpendicular).normalize();
    new DisplacementSculptBrushRaiseLower().dabApply(face, brushesTestDab(face, { axis: tilted, edge: 'hard' }));
    expect(Math.max(...face.displacement.offsets)).toBeCloseTo(
      sideways.distance * tilted.dot(face.placement.normal),
      9,
    );
  });

  it('paints alphas towards the alpha value or zero, clamped to the alpha range, without moving offsets', () => {
    const face = brushesTestTopFaceCreate();
    const brush = new DisplacementSculptBrushAlpha();
    const dab = brushesTestDab(face, { edge: 'hard', alphaValue: DISPLACEMENT_ALPHA_MAX * 3 });
    expect(brush.dabApply(face, dab)).toBe(true);
    expect(Math.max(...face.displacement.alphas)).toBe(DISPLACEMENT_ALPHA_MAX);
    expect(face.displacement.offsets.every((offset) => offset === 0)).toBe(true);
    brush.dabApply(face, { ...dab, edge: 'soft', direction: -1 });
    brush.dabApply(face, { ...dab, alphaValue: -DISPLACEMENT_ALPHA_MAX, direction: 1 });
    face.displacement.alphas.forEach((alpha) => {
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(DISPLACEMENT_ALPHA_MAX);
    });
    expect(Math.min(...face.displacement.alphas)).toBe(0);
  });

  it('creates the alpha brush for Paint Alpha and the effect brush for Paint Geometry', () => {
    expect(displacementSculptBrushCreate('paint_alpha', 'raise_to', 1)).toBeInstanceOf(DisplacementSculptBrushAlpha);
    expect(displacementSculptBrushCreate('paint_geometry', 'raise_to', 1)).toBeInstanceOf(
      DisplacementSculptBrushRaiseTo,
    );
    expect(displacementSculptBrushCreate('paint_geometry', 'raise_lower', 1)).toBeInstanceOf(
      DisplacementSculptBrushRaiseLower,
    );
  });
});
