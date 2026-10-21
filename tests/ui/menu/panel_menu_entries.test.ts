import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PanelMenu } from '@/ui/menu/panel_menu.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { FloatingPanelStack } from '@/ui/floating_panel/panel_floating_stack.js';

/**
 * Returns the labels of the item buttons rendered directly inside a panel
 * element, in order.
 *
 * @param panelElement Menu panel root.
 * @returns Visible row labels.
 */
function rowLabels(panelElement: HTMLElement): string[] {
  const labels: string[] = [];
  panelElement.querySelectorAll(':scope > button, :scope > div > button').forEach((button) => {
    const label = button.querySelector('.editor-toolbar-dropdown-label');
    if (label?.textContent) labels.push(label.textContent);
  });
  return labels;
}

/**
 * Returns the flyout element of the first submenu row in a panel.
 *
 * @param panelElement Menu panel root.
 * @returns Flyout element.
 */
function firstFlyout(panelElement: HTMLElement): HTMLElement {
  const flyout = panelElement.querySelector('.editor-toolbar-dropdown-submenu');
  if (!(flyout instanceof HTMLElement)) throw new Error('missing flyout');
  return flyout;
}

/**
 * Menu panels can replace their rows and build submenu rows from a live source
 * every time the menu opens.
 */
describe('PanelMenu entries', () => {
  let host: HTMLElement;

  beforeEach(() => {
    FloatingPanelStack.resetForTests();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
  });

  it('replaces every row when entries are set', () => {
    const panel = new PanelMenu([{ label: 'Old', onClick: () => {} }], () => {});
    host.appendChild(panel.getElement());
    panel.entriesSet([
      { label: 'First', onClick: () => {} },
      { label: 'Second', onClick: () => {} },
    ]);
    expect(rowLabels(panel.getElement())).toEqual(['First', 'Second']);
  });

  it('rebuilds a live submenu from its source each time the menu opens', () => {
    const liveLabels = ['Alpha'];
    const childrenResolve = (): ToolbarMenuEntry[] => liveLabels.map((label) => ({ label, onClick: () => {} }));
    const panel = new PanelMenu([{ kind: 'submenu', label: 'Live', children: [], childrenResolve }], () => {});
    host.appendChild(panel.getElement());
    panel.open();
    expect(rowLabels(firstFlyout(panel.getElement()))).toEqual(['Alpha']);
    panel.close();
    liveLabels.push('Beta');
    panel.open();
    expect(rowLabels(firstFlyout(panel.getElement()))).toEqual(['Alpha', 'Beta']);
  });

  it('runs the action of a row built from a live source', () => {
    const clicked: string[] = [];
    const childrenResolve = (): ToolbarMenuEntry[] => [{ label: 'Pick', onClick: () => clicked.push('Pick') }];
    const panel = new PanelMenu([{ kind: 'submenu', label: 'Live', children: [], childrenResolve }], () => {});
    host.appendChild(panel.getElement());
    panel.open();
    const pickButton = firstFlyout(panel.getElement()).querySelector('button');
    pickButton?.click();
    expect(clicked).toEqual(['Pick']);
  });
});
