import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { DISPLACEMENT_ACTIVE_TOOLS } from '@/displacement/model/displacement_types.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { displacementTestAlphasRead } from '../displacement_test_rig.js';
import { BUTTON_COMPACT_FONT_SIZE, BUTTON_COMPACT_WRAPPED_LINE_HEIGHT } from '@/ui/button/button_compact.js';
import {
  PANEL_DISPLACEMENT_TOOLS_BUTTON_HEIGHT_PX,
  PANEL_DISPLACEMENT_TOOLS_COLUMN_COUNT,
} from '@/displacement/ui/panel_displacement_tools_section.js';
import {
  displacementUiButtonFind,
  displacementUiTabCreate,
  displacementUiTopFaceAdd,
} from './panel_displacement_test_support.js';

/** Labels of the viewport tool toggles, by tool. */
const TOOLS_TEST_TOGGLE_LABELS = { select: 'Select', paint_geometry: 'Paint Geometry', paint_alpha: 'Paint Alpha' };

/** Buttons that need a displaced face in the selection. */
const TOOLS_TEST_DISPLACED_LABELS = [
  'Paint Geometry',
  'Paint Alpha',
  'Invert Alpha',
  'Destroy',
  'Subdivide',
  'Noise',
  'Sew',
];

/** Every button of the Tools grid. */
const TOOLS_TEST_ALL_LABELS = new Set(['Select', 'Create', ...TOOLS_TEST_DISPLACED_LABELS]);

/**
 * Reads which toggles show as pressed.
 *
 * @param root Tab root.
 * @returns Labels of the pressed toggles.
 */
function toolsTestPressedRead(root: HTMLElement): string[] {
  return DISPLACEMENT_ACTIVE_TOOLS.map((tool) => TOOLS_TEST_TOGGLE_LABELS[tool]).filter(
    (label) => displacementUiButtonFind(root, label).getAttribute('aria-pressed') === 'true',
  );
}

/** Tools group of the Displacement tab. */
describe('PanelDisplacementToolsSection', () => {
  afterEach(() => {
    getStateDisplacementSculpt().reset();
    getStateFaceEditSession().reset();
    document.body.replaceChildren();
  });

  it('switches the viewport tool exclusively and returns to Select when the active paint tool is clicked', () => {
    const { tab, rig, selection, changeNotify } = displacementUiTabCreate('ToolsToggle');
    selection.push(displacementUiTopFaceAdd(rig, new THREE.Vector3(0, 1, 0)));
    changeNotify();
    displacementUiButtonFind(tab.getElement(), 'Create').click();
    const root = tab.getElement();
    expect(toolsTestPressedRead(root)).toEqual(['Select']);
    displacementUiButtonFind(root, 'Paint Geometry').click();
    expect(getStateDisplacementSculpt().settingsRead().activeTool).toBe('paint_geometry');
    expect(toolsTestPressedRead(root)).toEqual(['Paint Geometry']);
    displacementUiButtonFind(root, 'Paint Alpha').click();
    expect(toolsTestPressedRead(root)).toEqual(['Paint Alpha']);
    displacementUiButtonFind(root, 'Paint Alpha').click();
    expect(getStateDisplacementSculpt().settingsRead().activeTool).toBe('select');
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_geometry' });
    expect(toolsTestPressedRead(root)).toEqual(['Paint Geometry']);
    tab.dispose();
  });

  it('enables Create for any selected face and the other tools only for displaced faces', () => {
    const { tab, rig, selection, changeNotify } = displacementUiTabCreate('ToolsEnabled');
    const root = tab.getElement();
    expect(displacementUiButtonFind(root, 'Create').disabled).toBe(true);
    TOOLS_TEST_DISPLACED_LABELS.forEach((label) => expect(displacementUiButtonFind(root, label).disabled).toBe(true));
    selection.push(displacementUiTopFaceAdd(rig, new THREE.Vector3(-3, 0, 2)));
    changeNotify();
    expect(displacementUiButtonFind(root, 'Create').disabled).toBe(false);
    TOOLS_TEST_DISPLACED_LABELS.forEach((label) => expect(displacementUiButtonFind(root, label).disabled).toBe(true));
    displacementUiButtonFind(root, 'Create').click();
    TOOLS_TEST_DISPLACED_LABELS.forEach((label) => expect(displacementUiButtonFind(root, label).disabled).toBe(false));
    rig.commandStack.undo();
    changeNotify();
    expect(displacementUiButtonFind(root, 'Destroy').disabled).toBe(true);
    tab.dispose();
  });

  it('lays the buttons out in an equal-column grid of equally tall buttons whose labels wrap onto two lines', () => {
    const { tab } = displacementUiTabCreate('ToolsLayout');
    const buttons = [...TOOLS_TEST_ALL_LABELS].map((label) => displacementUiButtonFind(tab.getElement(), label));
    const grid = buttons[0]?.parentElement;
    if (!grid) throw new Error('tool buttons have no grid');
    expect(grid.style.display).toBe('grid');
    expect(grid.style.gridTemplateColumns).toBe(`repeat(${PANEL_DISPLACEMENT_TOOLS_COLUMN_COUNT}, minmax(0, 1fr))`);
    const twoLinesPx = 2 * parseFloat(BUTTON_COMPACT_FONT_SIZE) * Number(BUTTON_COMPACT_WRAPPED_LINE_HEIGHT);
    expect(PANEL_DISPLACEMENT_TOOLS_BUTTON_HEIGHT_PX).toBeGreaterThanOrEqual(twoLinesPx);
    buttons.forEach((button) => {
      expect(button.parentElement).toBe(grid);
      expect(button.style.whiteSpace).toBe('normal');
      expect(button.style.textAlign).toBe('center');
      expect(button.style.width).toBe('100%');
      expect(button.style.height).toBe(`${PANEL_DISPLACEMENT_TOOLS_BUTTON_HEIGHT_PX}px`);
    });
    tab.dispose();
  });

  it('inverts the alpha of the selected displaced face as one undo step', () => {
    const { tab, rig, selection, changeNotify } = displacementUiTabCreate('ToolsInvert');
    const target = displacementUiTopFaceAdd(rig, new THREE.Vector3(4, 2, 0));
    selection.push(target);
    changeNotify();
    displacementUiButtonFind(tab.getElement(), 'Create').click();
    const alphasBefore = displacementTestAlphasRead(target);
    const undoCountBefore = rig.commandStack.getUndoCount();
    displacementUiButtonFind(tab.getElement(), 'Invert Alpha').click();
    expect(rig.commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    expect(displacementTestAlphasRead(target)).not.toEqual(alphasBefore);
    rig.commandStack.undo();
    expect(displacementTestAlphasRead(target)).toEqual(alphasBefore);
    tab.dispose();
  });
});
