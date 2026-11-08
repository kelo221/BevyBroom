import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Theme } from '@/theme.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { SPRINKLE_GRID_SIZE_MIN, SPRINKLE_PLACEMENT_MODES } from '@/tools/sprinkle/sprinkle_types.js';
import { getStateSprinkleDefinitionLibrary } from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';
import { DialogSprinkle } from '@/tools/sprinkle/ui/dialog_sprinkle.js';
import { SPRINKLE_CONTROLS_DEFINITION_EMPTY_HINT } from '@/tools/sprinkle/ui/controls/sprinkle_controls_definition.js';
import {
  displacementUiButtonFind,
  displacementUiFieldCommit,
  displacementUiFieldFind,
} from '../../../displacement/ui/panel_displacement_test_support.js';
import { cssColorNormalize } from '../../../ui/ui_css_color_test_support.js';
import {
  sprinkleUiTestDefinitionCreate,
  sprinkleUiTestLibraryInstall,
  sprinkleUiTestReset,
  sprinkleUiTestServicesCreate,
  type SprinkleUiTestLoader,
  type SprinkleUiTestServices,
} from './sprinkle_ui_test_support.js';

/** Accessible names of every field the window shows. */
const DIALOG_SPRINKLE_TEST_FIELD_LABELS: readonly string[] = [
  'Sprinkle type',
  'Sprinkle mode',
  'Sprinkle density',
  'Sprinkle density value',
  'Sprinkle grid offset U',
  'Sprinkle grid offset V',
  'Sprinkle grid size U',
  'Sprinkle grid size V',
  'Use Grid Size from Definition',
  'Random Yaw',
  'Align to Normal',
];

/** Window, its recorded services and the library loader of one test. */
interface DialogSprinkleTestRig {
  readonly dialog: DialogSprinkle;
  readonly root: HTMLElement;
  readonly recorded: SprinkleUiTestServices;
  readonly loader: SprinkleUiTestLoader;
}

/** Rig built by the running test. */
let dialogSprinkleTestRig: DialogSprinkleTestRig | null = null;

/**
 * Builds the window over a fresh library and recording services.
 *
 * @param gridInterval Editor grid interval the services report.
 * @returns Test rig remembered for cleanup.
 */
function dialogSprinkleTestRigCreate(gridInterval: number | null = 0.5): DialogSprinkleTestRig {
  const loader = sprinkleUiTestLibraryInstall();
  const recorded = sprinkleUiTestServicesCreate(gridInterval);
  const dialog = new DialogSprinkle(document.body, recorded.services);
  dialog.show();
  dialogSprinkleTestRig = { dialog, root: dialog.getRootElement(), recorded, loader };
  return dialogSprinkleTestRig;
}

/**
 * Finds an input under the window by its accessible name.
 *
 * @param label Accessible name.
 * @returns Input element.
 */
function dialogSprinkleTestInputFind(label: string): HTMLInputElement {
  if (!dialogSprinkleTestRig) throw new Error('rig missing');
  return displacementUiFieldFind<HTMLInputElement>(dialogSprinkleTestRig.root, label);
}

/**
 * Finds a select under the window by its accessible name.
 *
 * @param label Accessible name.
 * @returns Select element.
 */
function dialogSprinkleTestSelectFind(label: string): HTMLSelectElement {
  if (!dialogSprinkleTestRig) throw new Error('rig missing');
  return displacementUiFieldFind<HTMLSelectElement>(dialogSprinkleTestRig.root, label);
}

/**
 * Chooses an entry of a select and fires its change event.
 *
 * @param select Select element.
 * @param value Entry value.
 */
function dialogSprinkleTestSelectChoose(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

/**
 * Lists the entry values of a select.
 *
 * @param select Select element.
 * @returns Values of the visible entries in order.
 */
function dialogSprinkleTestOptionValuesRead(select: HTMLSelectElement): string[] {
  return [...select.options].filter((option) => !option.hidden).map((option) => option.value);
}

/**
 * Returns the notice line of the window.
 *
 * @returns Notice element.
 */
function dialogSprinkleTestNoticeRead(): HTMLElement {
  const notice = dialogSprinkleTestRig?.root.querySelector<HTMLElement>('.sprinkle-controls-definition-notice');
  if (!notice) throw new Error('notice missing');
  return notice;
}

beforeEach(() => {
  sprinkleUiTestReset();
});

afterEach(() => {
  dialogSprinkleTestRig?.dialog.dispose();
  dialogSprinkleTestRig = null;
  sprinkleUiTestReset();
});

/** Hammer++ style Entity Sprinkle window. */
describe('DialogSprinkle', () => {
  it('builds every control of the Entity Sprinkle layout and lists every placement mode', () => {
    const { root } = dialogSprinkleTestRigCreate();
    expect(root.textContent).toContain('Entity Sprinkle');
    DIALOG_SPRINKLE_TEST_FIELD_LABELS.forEach((label) => {
      expect(root.querySelector(`[aria-label="${label}"]`), label).not.toBeNull();
    });
    ['Refresh', 'Open Source', 'Use Grid'].forEach((text) => displacementUiButtonFind(root, text));
    expect(dialogSprinkleTestOptionValuesRead(dialogSprinkleTestSelectFind('Sprinkle mode'))).toEqual([
      ...SPRINKLE_PLACEMENT_MODES,
    ]);
  });

  it('shows configuration changes made elsewhere', () => {
    dialogSprinkleTestRigCreate();
    const defaults = getStateSprinkleTool().configRead();
    const lastMode = SPRINKLE_PLACEMENT_MODES[SPRINKLE_PLACEMENT_MODES.length - 1];
    if (!lastMode) throw new Error('no modes');
    getStateSprinkleTool().configPatch({
      mode: lastMode,
      densityPercent: defaults.densityPercent + 10,
      gridOffsetU: defaults.gridOffsetU + 0.25,
      gridOffsetV: defaults.gridOffsetV - 0.75,
      gridSizeFromDefinition: false,
      gridSizeU: defaults.gridSizeU * 3,
      gridSizeV: defaults.gridSizeV * 5,
      randomYaw: !defaults.randomYaw,
      alignToNormal: !defaults.alignToNormal,
    });
    const config = getStateSprinkleTool().configRead();
    expect(dialogSprinkleTestSelectFind('Sprinkle mode').value).toBe(lastMode);
    expect(Number(dialogSprinkleTestInputFind('Sprinkle density value').value)).toBe(config.densityPercent);
    expect(Number(dialogSprinkleTestInputFind('Sprinkle grid offset U').value)).toBe(config.gridOffsetU);
    expect(Number(dialogSprinkleTestInputFind('Sprinkle grid offset V').value)).toBe(config.gridOffsetV);
    expect(Number(dialogSprinkleTestInputFind('Sprinkle grid size U').value)).toBe(config.gridSizeU);
    expect(Number(dialogSprinkleTestInputFind('Sprinkle grid size V').value)).toBe(config.gridSizeV);
    expect(dialogSprinkleTestInputFind('Use Grid Size from Definition').checked).toBe(false);
    expect(dialogSprinkleTestInputFind('Random Yaw').checked).toBe(config.randomYaw);
    expect(dialogSprinkleTestInputFind('Align to Normal').checked).toBe(config.alignToNormal);
  });

  it('writes each placement control into its own configuration field', () => {
    dialogSprinkleTestRigCreate();
    const defaults = getStateSprinkleTool().configRead();
    const otherMode = SPRINKLE_PLACEMENT_MODES.find((mode) => mode !== defaults.mode);
    if (!otherMode) throw new Error('no other mode');
    dialogSprinkleTestSelectChoose(dialogSprinkleTestSelectFind('Sprinkle mode'), otherMode);
    expect(getStateSprinkleTool().configRead().mode).toBe(otherMode);
    const density = (defaults.densityPercent + 40) % 100;
    displacementUiFieldCommit(dialogSprinkleTestInputFind('Sprinkle density value'), String(density));
    expect(getStateSprinkleTool().configRead().densityPercent).toBe(density);
    dialogSprinkleTestInputFind('Random Yaw').click();
    expect(getStateSprinkleTool().configRead().randomYaw).toBe(!defaults.randomYaw);
    dialogSprinkleTestInputFind('Align to Normal').click();
    expect(getStateSprinkleTool().configRead().alignToNormal).toBe(!defaults.alignToNormal);
    expect(getStateSprinkleTool().configRead()).toMatchObject({
      gridOffsetU: defaults.gridOffsetU,
      gridSizeU: defaults.gridSizeU,
      gridSizeFromDefinition: defaults.gridSizeFromDefinition,
    });
  });

  it('clamps the density to percent and keeps the stored density when the box holds no number', () => {
    dialogSprinkleTestRigCreate();
    displacementUiFieldCommit(dialogSprinkleTestInputFind('Sprinkle density value'), '250');
    expect(getStateSprinkleTool().configRead().densityPercent).toBe(100);
    displacementUiFieldCommit(dialogSprinkleTestInputFind('Sprinkle density value'), 'many');
    expect(getStateSprinkleTool().configRead().densityPercent).toBe(100);
    expect(Number(dialogSprinkleTestInputFind('Sprinkle density value').value)).toBe(100);
  });

  it('writes the grid offset, the grid size and the definition grid toggle', () => {
    dialogSprinkleTestRigCreate();
    const defaults = getStateSprinkleTool().configRead();
    dialogSprinkleTestInputFind('Use Grid Size from Definition').click();
    expect(getStateSprinkleTool().configRead().gridSizeFromDefinition).toBe(!defaults.gridSizeFromDefinition);
    const offsetU = defaults.gridOffsetU + 0.5;
    const sizeV = defaults.gridSizeV * 4;
    displacementUiFieldCommit(dialogSprinkleTestInputFind('Sprinkle grid offset U'), String(offsetU));
    displacementUiFieldCommit(dialogSprinkleTestInputFind('Sprinkle grid size V'), String(sizeV));
    expect(getStateSprinkleTool().configRead()).toMatchObject({
      gridOffsetU: offsetU,
      gridOffsetV: defaults.gridOffsetV,
      gridSizeU: defaults.gridSizeU,
      gridSizeV: sizeV,
    });
  });

  it('keeps the stored grid size when a typed size is below the smallest grid size', () => {
    dialogSprinkleTestRigCreate();
    getStateSprinkleTool().configPatch({ gridSizeFromDefinition: false });
    const before = getStateSprinkleTool().configRead().gridSizeU;
    displacementUiFieldCommit(dialogSprinkleTestInputFind('Sprinkle grid size U'), String(SPRINKLE_GRID_SIZE_MIN / 2));
    expect(getStateSprinkleTool().configRead().gridSizeU).toBe(before);
    expect(Number(dialogSprinkleTestInputFind('Sprinkle grid size U').value)).toBe(before);
  });

  it('disables the grid size boxes and shows the definition grid while the definition grid is used', () => {
    dialogSprinkleTestRigCreate();
    const custom = getStateSprinkleTool().configRead();
    const grid = { sizeU: custom.gridSizeU * 2, sizeV: custom.gridSizeV * 3 };
    getStateSprinkleDefinitionLibrary().contentsWrite({
      definitions: [sprinkleUiTestDefinitionCreate('Rocks', grid)],
      problems: [],
    });
    getStateSprinkleTool().configPatch({ gridSizeFromDefinition: true });
    expect(dialogSprinkleTestInputFind('Sprinkle grid size U').disabled).toBe(true);
    expect(dialogSprinkleTestInputFind('Sprinkle grid size V').disabled).toBe(true);
    expect(Number(dialogSprinkleTestInputFind('Sprinkle grid size U').value)).toBe(grid.sizeU);
    expect(Number(dialogSprinkleTestInputFind('Sprinkle grid size V').value)).toBe(grid.sizeV);
    getStateSprinkleTool().configPatch({ gridSizeFromDefinition: false });
    expect(dialogSprinkleTestInputFind('Sprinkle grid size U').disabled).toBe(false);
    expect(Number(dialogSprinkleTestInputFind('Sprinkle grid size U').value)).toBe(custom.gridSizeU);
    expect(Number(dialogSprinkleTestInputFind('Sprinkle grid size V').value)).toBe(custom.gridSizeV);
  });

  it('copies the editor grid size on Use Grid and stops using the definition grid', () => {
    const editorGrid = SPRINKLE_GRID_SIZE_MIN * 37;
    const { root } = dialogSprinkleTestRigCreate(editorGrid);
    getStateSprinkleTool().configPatch({ gridSizeFromDefinition: true });
    displacementUiButtonFind(root, 'Use Grid').click();
    expect(getStateSprinkleTool().configRead()).toMatchObject({
      gridSizeU: editorGrid,
      gridSizeV: editorGrid,
      gridSizeFromDefinition: false,
    });
    expect(dialogSprinkleTestInputFind('Use Grid Size from Definition').checked).toBe(false);
    expect(dialogSprinkleTestInputFind('Sprinkle grid size U').disabled).toBe(false);
  });

  it('reports instead of copying when no editor grid size is available', () => {
    const { root, recorded } = dialogSprinkleTestRigCreate(null);
    const before = getStateSprinkleTool().configRead();
    displacementUiButtonFind(root, 'Use Grid').click();
    expect(getStateSprinkleTool().configRead()).toEqual(before);
    expect(recorded.reports).toHaveLength(1);
  });

  it('lists the loaded types, picks the first and falls back to the first when the chosen one disappears', () => {
    dialogSprinkleTestRigCreate();
    const library = getStateSprinkleDefinitionLibrary();
    const names = ['Rocks', 'Grass', 'Trees'];
    library.contentsWrite({
      definitions: names.map((name) => sprinkleUiTestDefinitionCreate(name, null)),
      problems: [],
    });
    const typeSelect = dialogSprinkleTestSelectFind('Sprinkle type');
    expect(dialogSprinkleTestOptionValuesRead(typeSelect)).toEqual(names);
    expect(getStateSprinkleTool().configRead().definitionName).toBe(names[0]);
    const chosen = names[2] ?? '';
    dialogSprinkleTestSelectChoose(typeSelect, chosen);
    expect(getStateSprinkleTool().configRead().definitionName).toBe(chosen);
    const remaining = names.filter((name) => name !== chosen).reverse();
    library.contentsWrite({
      definitions: remaining.map((name) => sprinkleUiTestDefinitionCreate(name, null)),
      problems: [],
    });
    expect(dialogSprinkleTestOptionValuesRead(typeSelect)).toEqual(remaining);
    expect(getStateSprinkleTool().configRead().definitionName).toBe(remaining[0]);
    expect(typeSelect.value).toBe(remaining[0]);
  });

  it('reloads the library through its loader on Refresh', async () => {
    const { root, loader } = dialogSprinkleTestRigCreate();
    loader.loadResult = { definitions: [sprinkleUiTestDefinitionCreate('Bushes', null)], problems: [] };
    displacementUiButtonFind(root, 'Refresh').click();
    expect(loader.load).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(getStateSprinkleTool().configRead().definitionName).toBe('Bushes'));
    expect(dialogSprinkleTestOptionValuesRead(dialogSprinkleTestSelectFind('Sprinkle type'))).toEqual(['Bushes']);
  });

  it('opens the active definition file on Open Source and reports why it did not open', async () => {
    const { root, loader, recorded } = dialogSprinkleTestRigCreate();
    const definition = sprinkleUiTestDefinitionCreate('Rocks', null);
    const openSource = displacementUiButtonFind(root, 'Open Source');
    expect(openSource.disabled).toBe(true);
    getStateSprinkleDefinitionLibrary().contentsWrite({ definitions: [definition], problems: [] });
    expect(openSource.disabled).toBe(false);
    loader.sourceOpenAnswer = 'No text editor is set up for .txt files';
    openSource.click();
    expect(loader.sourceOpen).toHaveBeenCalledExactlyOnceWith(definition.sourcePath);
    await vi.waitFor(() => expect(recorded.reports).toContain(loader.sourceOpenAnswer));
  });

  it('shows a hint while no types are loaded and the load problems in the error color', () => {
    dialogSprinkleTestRigCreate();
    const notice = dialogSprinkleTestNoticeRead();
    expect(notice.textContent).toBe(SPRINKLE_CONTROLS_DEFINITION_EMPTY_HINT);
    const problems = ['rocks.txt line 3: unknown key "wieght"', 'grass.txt: no cases'];
    getStateSprinkleDefinitionLibrary().contentsWrite({
      definitions: [sprinkleUiTestDefinitionCreate('Trees', null)],
      problems,
    });
    expect(notice.style.display).not.toBe('none');
    expect(notice.textContent).toContain(problems[0]);
    expect(notice.title).toBe(problems.join('\n'));
    expect(cssColorNormalize(notice.style.color)).toBe(cssColorNormalize(Theme.severityErrorColor));
    getStateSprinkleDefinitionLibrary().contentsWrite({
      definitions: [sprinkleUiTestDefinitionCreate('Trees', null)],
      problems: [],
    });
    expect(notice.style.display).toBe('none');
  });

  it('returns the viewport tool to Select when closed while the Sprinkle tool is active', () => {
    const { dialog, root, recorded } = dialogSprinkleTestRigCreate();
    getStateSprinkleTool().toolActiveWrite(true);
    root.querySelector<HTMLButtonElement>('button[title="Close"]')?.click();
    expect(dialog.isOpen()).toBe(false);
    expect(recorded.toolSelectExit).toHaveBeenCalledOnce();
    dialog.show();
    getStateSprinkleTool().toolActiveWrite(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dialog.isOpen()).toBe(false);
    expect(recorded.toolSelectExit).toHaveBeenCalledTimes(2);
  });

  it('keeps the viewport tool when closed while the Sprinkle tool is inactive or disposed', () => {
    const { dialog, recorded } = dialogSprinkleTestRigCreate();
    dialog.hide();
    expect(recorded.toolSelectExit).not.toHaveBeenCalled();
    dialog.show();
    getStateSprinkleTool().toolActiveWrite(true);
    dialog.dispose();
    expect(recorded.toolSelectExit).not.toHaveBeenCalled();
  });
});
