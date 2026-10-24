import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ViewportToolShapeDropdown } from '@/tools/chrome/options/viewport_tool_shape_dropdown.js';
import { ViewportToolShapeParameters } from '@/tools/chrome/options/viewport_tool_shape_parameters.js';
import { ShapeDrawSettings } from '@/tools/shape_draw/shapes/shape_draw_settings.js';
import { FloatingPanelStack } from '@/ui/floating_panel/panel_floating_stack.js';

describe('ViewportToolShapeDropdown', () => {
  let host: HTMLElement;

  beforeEach(() => {
    FloatingPanelStack.resetForTests();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    document.body.replaceChildren();
    FloatingPanelStack.resetForTests();
  });

  it('lists every shape with icons and reports the picked shape', () => {
    const settings = new ShapeDrawSettings();
    const chosen: string[] = [];
    const dropdown = new ViewportToolShapeDropdown(host, settings, (shapeId) => {
      chosen.push(shapeId);
    });
    host.appendChild(dropdown.getElement());
    const trigger = host.querySelector('button') as HTMLButtonElement;
    Object.defineProperty(trigger, 'getBoundingClientRect', {
      value: () => ({ left: 20, bottom: 50, top: 26, right: 120, width: 100, height: 24 }),
    });
    trigger.click();
    const panel = dropdown.getMenuPanel();
    expect(panel?.isOpen()).toBe(true);
    const menu = panel?.getElement();
    const rows = Array.from(menu?.querySelectorAll('button') ?? []);
    expect(rows.length).toBe(7);
    expect(menu?.querySelectorAll('.editor-icon').length).toBe(7);
    const archRow = rows.find((row) => (row.textContent ?? '').includes('Arch')) as HTMLButtonElement;
    archRow.click();
    expect(chosen).toEqual(['arch']);
    expect(settings.getSelectedShapeId()).toBe('arch');
    dropdown.dispose();
  });

  it('refreshes the trigger icon after a selection change', () => {
    const settings = new ShapeDrawSettings();
    const dropdown = new ViewportToolShapeDropdown(host, settings, (shapeId) => {
      settings.shapeSelect(shapeId);
      dropdown.selectionRefresh();
    });
    host.appendChild(dropdown.getElement());
    const trigger = host.querySelector('button') as HTMLButtonElement;
    trigger.click();
    const menu = dropdown.getMenuPanel()?.getElement();
    const coneRow = Array.from(menu?.querySelectorAll('button') ?? []).find((row) =>
      (row.textContent ?? '').includes('Cone'),
    ) as HTMLButtonElement;
    coneRow.click();
    const icon = trigger.querySelector('.editor-icon');
    expect(icon?.getAttribute('data-icon')).toBe('shape-cone');
    dropdown.dispose();
  });
});

describe('ViewportToolShapeParameters', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('shows no fields for the cuboid and the shape fields for stairs', () => {
    const settings = new ShapeDrawSettings();
    const parameters = new ViewportToolShapeParameters(host, settings, () => undefined);
    host.appendChild(parameters.getElement());
    expect(parameters.getElement().querySelectorAll('input, select')).toHaveLength(0);
    settings.shapeSelect('stairs');
    parameters.rebuild();
    const labels = Array.from(parameters.getElement().querySelectorAll('span')).map((span) => span.textContent);
    expect(labels).toContain('Step Height');
    expect(labels).toContain('Direction');
    expect(parameters.getElement().querySelectorAll('select').length).toBe(1);
  });

  it('stores a committed numeric value into the settings', () => {
    const settings = new ShapeDrawSettings();
    settings.shapeSelect('stairs');
    let commits = 0;
    const parameters = new ViewportToolShapeParameters(host, settings, () => {
      commits += 1;
    });
    host.appendChild(parameters.getElement());
    const field = parameters.getElement().querySelector('input') as HTMLInputElement;
    field.value = '0.75';
    field.dispatchEvent(new Event('change'));
    expect(settings.parameterValuesRead('stairs')['stepHeight']).toBe(0.75);
    expect(commits).toBe(1);
  });
});
