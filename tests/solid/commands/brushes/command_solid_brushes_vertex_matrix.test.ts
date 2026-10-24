import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidBrushValidator } from '@/solid/brush/solid_brush_validator.js';
import { CommandSolidBrushesVertexMatrix } from '@/solid/commands/brushes/command_solid_brushes_vertex_matrix.js';
import { shearMatrixFromWorldBox } from '@/transform/shear/shear_matrix.js';
import { flipMirrorMatrixBuild } from '@/transform/flip/flip_axis.js';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import {
  solidBrushToolsTestBoxAdd,
  solidBrushToolsTestVertexKeys,
  solidBrushToolsTestWorldBounds,
  solidBrushToolsTestWorldVertices,
} from '../../../tools/csg/solid/solid_brush_tools_test_helpers.js';

/**
 * Builds an off-center box with a non-trivial UV on every face.
 *
 * @param name Model name.
 * @returns Model and brush.
 */
function vertexMatrixTestBoxCreate(name: string): { model: SolidModel; brush: SolidBrushInstance } {
  const model = new SolidModel(name);
  const brush = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(2, 3, 1.5), new THREE.Vector3(1.5, 0.5, -2));
  brush.brush.faces.forEach((_face, index) => {
    brush.setFaceSurface(index, {
      textureId: `face-${index}`,
      uv: new SurfaceUvMatrix(new THREE.Vector4(1.5, 0.25, 0, 0.1), new THREE.Vector4(0, 0.5, 2, -0.3)),
    });
  });
  return { model, brush };
}

/**
 * Returns the sorted keys of world points.
 *
 * @param points World points.
 * @returns Sorted coordinate keys.
 */
function vertexMatrixTestKeys(points: readonly THREE.Vector3[]): string[] {
  return points
    .map((point) =>
      point
        .toArray()
        .map((value) => value.toFixed(3).replace('-0.000', '0.000'))
        .join(','),
    )
    .sort();
}

/**
 * Returns the world UV of the first corner of a face for a world corner map.
 *
 * @param brush Brush instance.
 * @param faceIndex Face index.
 * @returns First corner in brush-local space and its UV.
 */
function vertexMatrixTestFaceCornerUv(
  brush: SolidBrushInstance,
  faceIndex: number,
): { local: THREE.Vector3; u: number; v: number } | null {
  const face = brush.brush.faces[faceIndex];
  const corner = face ? brush.brush.getFaceVertices(face)[0] : undefined;
  if (!corner) {
    return null;
  }
  const projected = brush.getFaceSurface(faceIndex).uv.project(corner);
  return { local: corner.clone(), u: projected.u, v: projected.v };
}

describe('CommandSolidBrushesVertexMatrix', () => {
  it('shears every world vertex by the matrix and keeps the brush valid', () => {
    const { model, brush } = vertexMatrixTestBoxCreate('ShearVertices');
    const bounds = solidBrushToolsTestWorldBounds([brush]);
    const matrix = shearMatrixFromWorldBox(bounds.min, bounds.max, 'y', 'x', 1.25);
    expect(matrix).not.toBeNull();
    if (!matrix) return;
    const expected = solidBrushToolsTestWorldVertices(brush).map((vertex) => vertex.applyMatrix4(matrix));
    const command = new CommandSolidBrushesVertexMatrix([{ model, brushId: brush.id, matrix, lockTextures: true }]);
    new CommandStack(16).push(command);
    expect(command.getEditResult().edited).toHaveLength(1);
    expect(SolidBrushValidator.validate(brush.brush).valid).toBe(true);
    expect(vertexMatrixTestKeys(solidBrushToolsTestWorldVertices(brush))).toEqual(vertexMatrixTestKeys(expected));
  });

  it('keeps each face texture coordinate glued to its corner while textures are locked', () => {
    const { model, brush } = vertexMatrixTestBoxCreate('ShearLock');
    const bounds = solidBrushToolsTestWorldBounds([brush]);
    const matrix = shearMatrixFromWorldBox(bounds.min, bounds.max, 'x', 'z', 0.75);
    if (!matrix) throw new Error('shear matrix missing');
    const before = brush.brush.faces.map((_face, index) => vertexMatrixTestFaceCornerUv(brush, index));
    new CommandStack(16).push(
      new CommandSolidBrushesVertexMatrix([{ model, brushId: brush.id, matrix, lockTextures: true }]),
    );
    brush.brush.faces.forEach((_face, index) => {
      const after = vertexMatrixTestFaceCornerUv(brush, index);
      expect(after?.u).toBeCloseTo(before[index]?.u ?? Number.NaN, 4);
      expect(after?.v).toBeCloseTo(before[index]?.v ?? Number.NaN, 4);
    });
  });

  it('mirrors a brush with outward planes and a texture per mirrored face', () => {
    const { model, brush } = vertexMatrixTestBoxCreate('MirrorBrush');
    const bounds = solidBrushToolsTestWorldBounds([brush]);
    const matrix = flipMirrorMatrixBuild('x', bounds.min.x);
    const expected = solidBrushToolsTestWorldVertices(brush).map((vertex) => vertex.applyMatrix4(matrix));
    const textures = new Set(brush.brush.faces.map((_face, index) => brush.getSurfaceTextureId(index)));
    new CommandStack(16).push(
      new CommandSolidBrushesVertexMatrix([{ model, brushId: brush.id, matrix, lockTextures: true }]),
    );
    expect(SolidBrushValidator.validate(brush.brush).valid).toBe(true);
    expect(vertexMatrixTestKeys(solidBrushToolsTestWorldVertices(brush))).toEqual(vertexMatrixTestKeys(expected));
    const mirroredTextures = new Set(brush.brush.faces.map((_face, index) => brush.getSurfaceTextureId(index)));
    expect(mirroredTextures).toEqual(textures);
  });

  it('undoes the matrix edit in one step', () => {
    const { model, brush } = vertexMatrixTestBoxCreate('ShearUndo');
    const original = solidBrushToolsTestVertexKeys(brush);
    const bounds = solidBrushToolsTestWorldBounds([brush]);
    const matrix = shearMatrixFromWorldBox(bounds.min, bounds.max, 'z', 'y', -0.5);
    if (!matrix) throw new Error('shear matrix missing');
    const stack = new CommandStack(16);
    stack.push(new CommandSolidBrushesVertexMatrix([{ model, brushId: brush.id, matrix, lockTextures: false }]));
    stack.undo();
    expect(solidBrushToolsTestVertexKeys(brush)).toEqual(original);
  });

  it('skips a matrix that flattens the brush', () => {
    const { model, brush } = vertexMatrixTestBoxCreate('FlattenSkip');
    const original = solidBrushToolsTestVertexKeys(brush);
    const flatten = new THREE.Matrix4().makeScale(1, 0, 1);
    const command = new CommandSolidBrushesVertexMatrix([
      { model, brushId: brush.id, matrix: flatten, lockTextures: false },
    ]);
    new CommandStack(16).push(command);
    expect(command.getEditResult().skipped).toHaveLength(1);
    expect(solidBrushToolsTestVertexKeys(brush)).toEqual(original);
  });
});
