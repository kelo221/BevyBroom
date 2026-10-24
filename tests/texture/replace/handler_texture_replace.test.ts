import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { HandlerTextureReplace } from '@/texture/replace/handler_texture_replace.js';
import { solidBrushToolsTestBoxAdd } from '../../tools/csg/solid/solid_brush_tools_test_helpers.js';

const TEXTURE_REPLACE_TEST_FIND_ID = 'replace-test-old';
const TEXTURE_REPLACE_TEST_NEW_ID = 'replace-test-new';
const TEXTURE_REPLACE_TEST_OTHER_ID = 'replace-test-other';

/** World, brushes and handler a replacement test acts on. */
interface TextureReplaceFixture {
  brushes: SolidBrushInstance[];
  selectionManager: ManagerSelection;
  commandStack: CommandStack;
  afterReplace: ReturnType<typeof vi.fn>;
  handler: HandlerTextureReplace;
}

/**
 * Builds two separate boxes whose every face uses the find material except face
 * zero of the first box, which uses another material.
 *
 * @returns Fixture with an empty selection.
 */
function fixtureCreate(): TextureReplaceFixture {
  const worldObject = new THREE.Group();
  const model = new SolidModel('TextureReplace');
  worldObject.add(model.root);
  const edges = new THREE.Vector3(1, 1, 1);
  const brushes = [0, 3].map((x) => solidBrushToolsTestBoxAdd(model, edges, new THREE.Vector3(x, 0, 0)));
  brushes.forEach((brush) => brushFacesPaint(brush, TEXTURE_REPLACE_TEST_FIND_ID));
  brushes[0]?.setFaceTextureId(0, TEXTURE_REPLACE_TEST_OTHER_ID);
  const selectionManager = new ManagerSelection();
  const commandStack = new CommandStack(16);
  const afterReplace = vi.fn();
  const handler = new HandlerTextureReplace({ commandStack, worldObject, selectionManager, afterReplace });
  return { brushes, selectionManager, commandStack, afterReplace, handler };
}

/**
 * Paints every face of a brush with one material.
 *
 * @param brush Brush to paint.
 * @param textureId Material id.
 */
function brushFacesPaint(brush: SolidBrushInstance, textureId: string): void {
  brush.brush.faces.forEach((_face, surfaceIndex) => brush.setFaceTextureId(surfaceIndex, textureId));
}

/**
 * Lists the material of every face of a brush.
 *
 * @param brush Brush to read.
 * @returns Material ids by face index.
 */
function brushTextureIds(brush: SolidBrushInstance | undefined): string[] {
  if (!brush) {
    throw new Error('fixture brush missing');
  }
  return brush.brush.faces.map((_face, surfaceIndex) => brush.getSurfaceTextureId(surfaceIndex));
}

/**
 * Counts the faces of brushes that use one material.
 *
 * @param brushes Brushes to read.
 * @param textureId Material id.
 * @returns Face count.
 */
function faceCountUsing(brushes: readonly SolidBrushInstance[], textureId: string): number {
  return brushes.flatMap((brush) => brushTextureIds(brush)).filter((id) => id === textureId).length;
}

/** Unit tests for replacing one material with another on brush faces. */
describe('HandlerTextureReplace', () => {
  it('repaints every face using the material and leaves other materials alone', () => {
    const fixture = fixtureCreate();
    const expectedCount = faceCountUsing(fixture.brushes, TEXTURE_REPLACE_TEST_FIND_ID);
    expect(fixture.handler.replace(TEXTURE_REPLACE_TEST_FIND_ID, TEXTURE_REPLACE_TEST_NEW_ID, 'all')).toBe(
      expectedCount,
    );
    expect(faceCountUsing(fixture.brushes, TEXTURE_REPLACE_TEST_FIND_ID)).toBe(0);
    expect(faceCountUsing(fixture.brushes, TEXTURE_REPLACE_TEST_NEW_ID)).toBe(expectedCount);
    expect(brushTextureIds(fixture.brushes[0])[0]).toBe(TEXTURE_REPLACE_TEST_OTHER_ID);
    expect(fixture.afterReplace).toHaveBeenCalledOnce();
  });

  it('undoes the whole replacement as one step', () => {
    const fixture = fixtureCreate();
    const before = fixture.brushes.map((brush) => brushTextureIds(brush));
    fixture.handler.replace(TEXTURE_REPLACE_TEST_FIND_ID, TEXTURE_REPLACE_TEST_NEW_ID, 'all');
    fixture.commandStack.undo();
    expect(fixture.brushes.map((brush) => brushTextureIds(brush))).toEqual(before);
  });

  it('limits the selection scope to the selected brushes', () => {
    const fixture = fixtureCreate();
    const [, selectedBrush] = fixture.brushes;
    if (!selectedBrush?.mesh) {
      throw new Error('fixture brush has no mesh');
    }
    const untouched = brushTextureIds(fixture.brushes[0]);
    fixture.selectionManager.setSelection([selectedBrush.mesh]);
    fixture.handler.replace(TEXTURE_REPLACE_TEST_FIND_ID, TEXTURE_REPLACE_TEST_NEW_ID, 'selection');
    expect(brushTextureIds(fixture.brushes[0])).toEqual(untouched);
    expect(faceCountUsing([selectedBrush], TEXTURE_REPLACE_TEST_FIND_ID)).toBe(0);
  });

  it('pushes no undo step when nothing matches or both materials are equal', () => {
    const fixture = fixtureCreate();
    expect(fixture.handler.replace('replace-test-missing', TEXTURE_REPLACE_TEST_NEW_ID, 'all')).toBe(0);
    expect(fixture.handler.replace(TEXTURE_REPLACE_TEST_FIND_ID, TEXTURE_REPLACE_TEST_FIND_ID, 'all')).toBe(0);
    expect(fixture.handler.replace(TEXTURE_REPLACE_TEST_FIND_ID, TEXTURE_REPLACE_TEST_NEW_ID, 'selection')).toBe(0);
    expect(fixture.commandStack.canUndo()).toBe(false);
    expect(fixture.afterReplace).not.toHaveBeenCalled();
  });
});
