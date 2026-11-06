import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { TextureReplaceRunner } from '@/texture/replace/texture_replace_runner.js';
import { solidBrushToolsTestBoxAdd } from '../../tools/csg/solid/solid_brush_tools_test_helpers.js';

const TEXTURE_REPLACE_RUNNER_TEST_FIND_ID = 'replace-runner-test-old';
const TEXTURE_REPLACE_RUNNER_TEST_NEW_ID = 'replace-runner-test-new';

/** Brushes, selection, undo stack and runner a runner test acts on. */
interface TextureReplaceRunnerFixture {
  readonly brushes: SolidBrushInstance[];
  readonly selectionManager: ManagerSelection;
  readonly commandStack: CommandStack;
  readonly resultReport: ReturnType<typeof vi.fn>;
  readonly runner: TextureReplaceRunner;
}

/**
 * Builds two separate boxes whose every face uses the find material.
 *
 * @returns Fixture with an empty selection and a spy result report.
 */
function textureReplaceRunnerFixtureCreate(): TextureReplaceRunnerFixture {
  const worldObject = new THREE.Group();
  const model = new SolidModel('TextureReplaceRunner');
  worldObject.add(model.root);
  const edges = new THREE.Vector3(1, 1, 1);
  const brushes = [0, 3].map((x) => solidBrushToolsTestBoxAdd(model, edges, new THREE.Vector3(x, 0, 0)));
  brushes.forEach((brush) =>
    brush.brush.faces.forEach((_face, index) => brush.setFaceTextureId(index, TEXTURE_REPLACE_RUNNER_TEST_FIND_ID)),
  );
  const selectionManager = new ManagerSelection();
  const commandStack = new CommandStack(16);
  const resultReport = vi.fn();
  const runner = new TextureReplaceRunner({
    commandStack,
    worldObject,
    selectionManager,
    afterReplace: () => undefined,
    resultReport,
  });
  return { brushes, selectionManager, commandStack, resultReport, runner };
}

/**
 * Counts the faces of brushes that use one material.
 *
 * @param brushes Brushes to read.
 * @param textureId Material id.
 * @returns Face count.
 */
function textureReplaceRunnerFaceCount(brushes: readonly SolidBrushInstance[], textureId: string): number {
  return brushes
    .flatMap((brush) => brush.brush.faces.map((_face, index) => brush.getSurfaceTextureId(index)))
    .filter((id) => id === textureId).length;
}

/** Unit tests for the shared material replacement runner. */
describe('TextureReplaceRunner', () => {
  it('replaces the material, returns the face count and reports the shared message', () => {
    const fixture = textureReplaceRunnerFixtureCreate();
    const expectedCount = textureReplaceRunnerFaceCount(fixture.brushes, TEXTURE_REPLACE_RUNNER_TEST_FIND_ID);
    const result = fixture.runner.run(TEXTURE_REPLACE_RUNNER_TEST_FIND_ID, TEXTURE_REPLACE_RUNNER_TEST_NEW_ID, 'all');
    expect(result.faceCount).toBe(expectedCount);
    expect(result.message).toBe(TextureReplaceRunner.messageFormat(expectedCount));
    expect(result.message).toContain(String(expectedCount));
    expect(fixture.resultReport).toHaveBeenCalledWith(result.message);
    expect(textureReplaceRunnerFaceCount(fixture.brushes, TEXTURE_REPLACE_RUNNER_TEST_NEW_ID)).toBe(expectedCount);
    expect(fixture.commandStack.getUndoCount()).toBe(1);
  });

  it('chooses the selection scope only while objects are selected', () => {
    const fixture = textureReplaceRunnerFixtureCreate();
    expect(fixture.runner.scopeForSelectionRead()).toBe('all');
    const selectedMesh = fixture.brushes[1]?.mesh;
    if (!selectedMesh) {
      throw new Error('fixture brush has no mesh');
    }
    fixture.selectionManager.setSelection([selectedMesh]);
    expect(fixture.runner.scopeForSelectionRead()).toBe('selection');
  });

  it('limits runInSelectionOrEverywhere to the selected brush when one is selected', () => {
    const fixture = textureReplaceRunnerFixtureCreate();
    const [unselected, selected] = fixture.brushes;
    if (!unselected || !selected?.mesh) {
      throw new Error('fixture brush missing');
    }
    fixture.selectionManager.setSelection([selected.mesh]);
    fixture.runner.runInSelectionOrEverywhere(TEXTURE_REPLACE_RUNNER_TEST_FIND_ID, TEXTURE_REPLACE_RUNNER_TEST_NEW_ID);
    expect(textureReplaceRunnerFaceCount([unselected], TEXTURE_REPLACE_RUNNER_TEST_NEW_ID)).toBe(0);
    expect(textureReplaceRunnerFaceCount([selected], TEXTURE_REPLACE_RUNNER_TEST_FIND_ID)).toBe(0);
  });

  it('reports a zero count when nothing matches and pushes no undo step', () => {
    const fixture = textureReplaceRunnerFixtureCreate();
    const result = fixture.runner.run('replace-runner-test-missing', TEXTURE_REPLACE_RUNNER_TEST_NEW_ID, 'all');
    expect(result.faceCount).toBe(0);
    expect(fixture.resultReport).toHaveBeenCalledWith(TextureReplaceRunner.messageFormat(0));
    expect(fixture.commandStack.canUndo()).toBe(false);
  });
});
