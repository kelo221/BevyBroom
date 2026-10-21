import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PanelMenu } from '@/ui/menu/panel_menu.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { FloatingPanelStack } from '@/ui/floating_panel/panel_floating_stack.js';
import { ICON_NAMES } from '@/ui/icons/icon_name.js';
import { IconRegistry } from '@/ui/icons/icon_registry.js';

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

  it('draws an entry icon in front of its label and leaves icon-less rows plain', () => {
    const iconName = ICON_NAMES[0];
    const panel = new PanelMenu(
      [
        { label: 'With Icon', icon: iconName, iconColor: '#00ff00', onClick: () => {} },
        { kind: 'submenu', label: 'Sub Icon', icon: iconName, children: [] },
        { label: 'Plain', onClick: () => {} },
      ],
      () => {},
    );
    host.appendChild(panel.getElement());
    const labels = [...panel.getElement().querySelectorAll('.editor-toolbar-dropdown-label')];
    expect(labels.map((label) => label.textContent)).toEqual(['With Icon', 'Sub Icon', 'Plain']);
    expect(labels[0]?.querySelector('path')?.getAttribute('d')).toBe(IconRegistry.pathOf(iconName));
    expect(labels[0]?.querySelector('path')?.getAttribute('fill')).toBe('#00ff00');
    expect(labels[1]?.querySelector('svg')).not.toBeNull();
    expect(labels[2]?.querySelector('svg')).toBeNull();
  });

  it('shows a check mark only on checkable rows whose live state is checked', () => {
    let isGridVisible = true;
    const panel = new PanelMenu(
      [
        { label: 'Show Grid', onClick: () => {}, isChecked: () => isGridVisible },
        { label: 'Plain', onClick: () => {} },
      ],
      () => {},
    );
    host.appendChild(panel.getElement());
    panel.open();
    const [gridRow, plainRow] = [...panel.getElement().querySelectorAll<HTMLButtonElement>(':scope > button')];
    expect(gridRow?.getAttribute('role')).toBe('menuitemcheckbox');
    expect(gridRow?.getAttribute('aria-checked')).toBe('true');
    expect(gridRow?.querySelector('.editor-toolbar-dropdown-check')?.textContent).toBe('✓');
    expect(plainRow?.querySelector('.editor-toolbar-dropdown-check')).toBeNull();
    panel.close();
    isGridVisible = false;
    panel.open();
    expect(gridRow?.getAttribute('aria-checked')).toBe('false');
    expect(gridRow?.querySelector('.editor-toolbar-dropdown-check')?.textContent).toBe('');
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
