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

  it('shows the paint options inside the host it was given, in the right dock', () => {
    windows.dispose();
    const host = document.createElement('div');
    document.body.appendChild(host);
    windows = new DisplacementPaintWindows(host);
    paintWindowsTestSheetShowDisplacement();
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_geometry' });
    expect(host.contains(windows.paintGeometryDialog.getRootElement())).toBe(true);
    expect(host.contains(windows.paintAlphaDialog.getRootElement())).toBe(false);
  });

  it('stays closed while the sheet does not show the Displacement tab', () => {
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_geometry' });
    expect(windows.paintGeometryDialog.isOpen()).toBe(false);
    paintWindowsTestSheetShowDisplacement();
    expect(windows.paintGeometryDialog.isOpen()).toBe(true);
  });
});
