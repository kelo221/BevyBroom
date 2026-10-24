import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { FaceUvOperationFit } from '@/texture/uv/operations/face_uv_operation_fit.js';
import { FaceUvOperationRotate } from '@/texture/uv/operations/face_uv_operation_rotate.js';
import {
  CommandTextureSolidFaceUvOperation,
  solidFaceUvOperationContextBuild,
} from '@/texture/commands/command_texture_solid_face_uv_operation.js';
import { CommandTextureSolidFaceUvSet } from '@/texture/commands/command_texture_solid_face_uv_set.js';
import { CommandTextureSolidFaceAssign } from '@/texture/commands/command_texture_solid_face_assign.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import { solidBrushToolsTestBoxAdd } from '../../tools/csg/solid/solid_brush_tools_test_helpers.js';

/**
 * Builds a non-cubic box brush.
 *
 * @returns Model, brush and every face as a target.
 */
function faceUvCommandTestBrushCreate(): {
  model: SolidModel;
  brush: SolidBrushInstance;
  targets: SolidFaceTextureTarget[];
} {
  const model = new SolidModel('FaceUvCommand');
  const brush = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(3, 2, 5), new THREE.Vector3(1, 0, -2));
  const targets = brush.brush.faces.map((_face, surfaceIndex) => ({ model, brushId: brush.id, surfaceIndex }));
  return { model, brush, targets };
}

/**
 * Returns the UV span of one face along U and V under its current matrix.
 *
 * @param brush Brush owning the face.
 * @param faceIndex Face index.
 * @returns U and V extents in tiles.
 */
function faceUvCommandTestSpan(brush: SolidBrushInstance, faceIndex: number): { u: number; v: number } {
  const context = solidFaceUvOperationContextBuild(brush, faceIndex);
  if (!context) throw new Error('face context missing');
  const bounds = context.uvBounds(brush.getFaceSurface(faceIndex).uv);
  return { u: bounds.maxU - bounds.minU, v: bounds.maxV - bounds.minV };
}

describe('CommandTextureSolidFaceUvOperation', () => {
  it('fits the texture once across every face of a brush', () => {
    const { brush, targets } = faceUvCommandTestBrushCreate();
    const command = new CommandTextureSolidFaceUvOperation(targets, new FaceUvOperationFit({ axis: 'both' }));
    new CommandStack(16).push(command);
    expect(command.getEditedFaceCount()).toBe(targets.length);
    for (const target of targets) {
      const span = faceUvCommandTestSpan(brush, target.surfaceIndex);
      expect(span.u).toBeCloseTo(1, 4);
      expect(span.v).toBeCloseTo(1, 4);
    }
  });

  it('restores the previous UV matrices on undo', () => {
    const { brush, targets } = faceUvCommandTestBrushCreate();
    const before = targets.map((target) => brush.getFaceSurface(target.surfaceIndex).uv);
    const stack = new CommandStack(16);
    stack.push(new CommandTextureSolidFaceUvOperation(targets, new FaceUvOperationRotate(30)));
    expect(brush.getFaceSurface(0).uv.equals(before[0] ?? SurfaceUvMatrix.identity())).toBe(false);
    stack.undo();
    targets.forEach((target, index) => {
      expect(brush.getFaceSurface(target.surfaceIndex).uv.equals(before[index] ?? SurfaceUvMatrix.identity())).toBe(
        true,
      );
    });
  });

  it('skips face indices the brush does not have', () => {
    const { model, brush } = faceUvCommandTestBrushCreate();
    const missing = { model, brushId: brush.id, surfaceIndex: brush.brush.faces.length };
    const command = new CommandTextureSolidFaceUvOperation([missing], new FaceUvOperationRotate(15));
    new CommandStack(16).push(command);
    expect(command.getEditedFaceCount()).toBe(0);
  });
});

describe('CommandTextureSolidFaceUvSet and CommandTextureSolidFaceAssign', () => {
  it('stores a UV matrix and keeps the texture, then paints a texture and keeps the UV matrix', () => {
    const { brush, targets } = faceUvCommandTestBrushCreate();
    const first = targets.slice(0, 1);
    const uv = new SurfaceUvMatrix(new THREE.Vector4(0.5, 0, 0, 0.25), new THREE.Vector4(0, 0, 0.5, 0.75));
    const textureBefore = brush.getSurfaceTextureId(0);
    const stack = new CommandStack(16);
    stack.push(new CommandTextureSolidFaceUvSet(first, uv));
    expect(brush.getFaceSurface(0).uv.equals(uv)).toBe(true);
    expect(brush.getSurfaceTextureId(0)).toBe(textureBefore);
    stack.push(new CommandTextureSolidFaceAssign(first, 'face-uv-test-texture'));
    expect(brush.getSurfaceTextureId(0)).toBe('face-uv-test-texture');
    expect(brush.getFaceSurface(0).uv.equals(uv)).toBe(true);
    stack.undo();
    expect(brush.getSurfaceTextureId(0)).toBe(textureBefore);
  });
});
