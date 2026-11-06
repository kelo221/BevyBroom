import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { DisplacementPaintWindows } from '@/displacement/ui/paint/displacement_paint_windows.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';

/** Opens the Face Edit Sheet on its Displacement tab. */
function paintWindowsTestSheetShowDisplacement(): void {
  getStateFaceEditSession().activeTabIdWrite('displacement');
  getStateFaceEditSession().sheetOpenWrite(true);
}

/** Paint Geometry and Paint Alpha windows following the active viewport tool. */
describe('DisplacementPaintWindows', () => {
  let windows: DisplacementPaintWindows;

  beforeEach(() => {
    windows = new DisplacementPaintWindows(document.body);
  });

  afterEach(() => {
    windows.dispose();
    getStateDisplacementSculpt().reset();
    getStateFaceEditSession().reset();
    document.body.replaceChildren();
  });

  it('opens the window of the active paint tool only', () => {
    paintWindowsTestSheetShowDisplacement();
    expect(windows.paintGeometryDialog.isOpen()).toBe(false);
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_geometry' });
    expect(windows.paintGeometryDialog.isOpen()).toBe(true);
    expect(windows.paintAlphaDialog.isOpen()).toBe(false);
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_alpha' });
    expect(windows.paintGeometryDialog.isOpen()).toBe(false);
    expect(windows.paintAlphaDialog.isOpen()).toBe(true);
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'select' });
    expect(windows.paintAlphaDialog.isOpen()).toBe(false);
  });

  it('returns to Select when the user closes a paint window', () => {
    paintWindowsTestSheetShowDisplacement();
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_geometry' });
    const closeButton = windows.paintGeometryDialog.getRootElement().querySelector('button');
    if (!closeButton) throw new Error('title bar close button missing');
    closeButton.click();
    expect(windows.paintGeometryDialog.isOpen()).toBe(false);
    expect(getStateDisplacementSculpt().settingsRead().activeTool).toBe('select');
  });

  it('closes the paint window when the sheet leaves the Displacement tab or closes', () => {
    paintWindowsTestSheetShowDisplacement();
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_alpha' });
    getStateFaceEditSession().activeTabIdWrite('material');
    expect(windows.paintAlphaDialog.isOpen()).toBe(false);
    expect(getStateDisplacementSculpt().settingsRead().activeTool).toBe('select');
    paintWindowsTestSheetShowDisplacement();
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_geometry' });
    getStateFaceEditSession().sheetOpenWrite(false);
    expect(windows.paintGeometryDialog.isOpen()).toBe(false);
  });

  it('reports the mouse bindings of a paint tool once when its window opens', () => {
    const messages: string[] = [];
    const reporting = new DisplacementPaintWindows(document.body, {
      statusReport: (message) => messages.push(message),
    });
    paintWindowsTestSheetShowDisplacement();
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_geometry' });
    getStateDisplacementSculpt().settingsWrite({ radius: 2 });
    expect(messages).toEqual([reporting.paintGeometryDialog.bindingHintRead()]);
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_alpha' });
    expect(messages).toEqual([
      reporting.paintGeometryDialog.bindingHintRead(),
      reporting.paintAlphaDialog.bindingHintRead(),
    ]);
    expect(messages.every((message) => message.includes('RMB') && message.includes('Shift+RMB'))).toBe(true);
    reporting.dispose();
  });

  it('opens the paint window beside the element the options name', () => {
    windows.dispose();
    const sheet = document.createElement('div');
    document.body.appendChild(sheet);
    const sheetRect = { left: 50, top: 70, width: 260, height: 400 };
    sheet.getBoundingClientRect = () =>
      ({ ...sheetRect, right: sheetRect.left + sheetRect.width, bottom: sheetRect.top + sheetRect.height }) as DOMRect;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: sheetRect.left + sheetRect.width * 4 });
    windows = new DisplacementPaintWindows(document.body, { besideElementRead: () => sheet });
    paintWindowsTestSheetShowDisplacement();
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_geometry' });
    const root = windows.paintGeometryDialog.getRootElement();
    expect(parseFloat(root.style.left)).toBeGreaterThan(sheetRect.left + sheetRect.width);
    expect(parseFloat(root.style.top)).toBe(sheetRect.top);
  });

  it('stays closed while the sheet does not show the Displacement tab', () => {
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_geometry' });
    expect(windows.paintGeometryDialog.isOpen()).toBe(false);
    paintWindowsTestSheetShowDisplacement();
    expect(windows.paintGeometryDialog.isOpen()).toBe(true);
  });
});
