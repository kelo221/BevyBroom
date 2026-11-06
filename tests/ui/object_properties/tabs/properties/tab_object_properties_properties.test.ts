import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { PanelProperties } from '@/ui/properties/panel_properties.js';
import { TabObjectPropertiesProperties } from '@/ui/object_properties/tabs/properties/tab_object_properties_properties.js';
import {
  objectPropertiesTestContextCreate,
  objectPropertiesTestFieldType,
} from '../../object_properties_test_support.js';

/** Header text of the panel's game components section. */
const GAME_COMPONENTS_SECTION_TITLE = 'Game Components';

/**
 * Types a new X position into the panel's first position field.
 *
 * @param panel Properties panel.
 * @param positionX Typed X position.
 */
function panelPositionXType(panel: PanelProperties, positionX: number): void {
  const positionField = panel.getContainer().querySelector('input');
  if (!positionField) {
    throw new Error('expected a position field');
  }
  objectPropertiesTestFieldType(positionField, String(positionX));
}

/**
 * The Properties tab borrows the shared properties panel while the dialog is
 * open, edits the dialog's objects through the dialog's command stack without
 * the game components section, and hands the panel back unchanged when the
 * dialog closes.
 */
describe('TabObjectPropertiesProperties', () => {
  it('attaches the shared panel on refresh, re-reads it while attached and detaches it on deactivate', () => {
    const object = new THREE.Mesh();
    const panel = new PanelProperties(Theme, new ManagerSelection());
    const { context } = objectPropertiesTestContextCreate([object], panel);
    const tab = new TabObjectPropertiesProperties(context);
    expect(panel.isHostAttached()).toBe(false);
    tab.refresh([object]);
    expect(panel.getContainer().parentElement).toBe(context.container);
    const refreshSpy = vi.spyOn(panel, 'refreshBoundObject');
    tab.refresh([object]);
    expect(refreshSpy).toHaveBeenCalledOnce();
    tab.deactivate();
    expect(panel.isHostAttached()).toBe(false);
    panel.dispose();
  });

  it('leaves game components to the Class Info tab and shows them again after detaching', () => {
    const object = new THREE.Mesh();
    const panel = new PanelProperties(Theme, new ManagerSelection());
    expect(panel.getContainer().textContent).toContain(GAME_COMPONENTS_SECTION_TITLE);
    const { context } = objectPropertiesTestContextCreate([object], panel);
    const tab = new TabObjectPropertiesProperties(context);
    tab.refresh([object]);
    expect(panel.getContainer().textContent).not.toContain(GAME_COMPONENTS_SECTION_TITLE);
    tab.deactivate();
    expect(panel.getContainer().textContent).toContain(GAME_COMPONENTS_SECTION_TITLE);
    panel.dispose();
  });

  it('edits the dialog objects through the tab stack while the selection points elsewhere', () => {
    const edited = new THREE.Mesh();
    const elsewhere = new THREE.Mesh();
    const selectionManager = new ManagerSelection();
    const panel = new PanelProperties(Theme, selectionManager);
    const panelStack = new CommandStack(64);
    panel.setCommandStack(panelStack);
    const { context, commandStack } = objectPropertiesTestContextCreate([edited], panel);
    const tab = new TabObjectPropertiesProperties(context);
    tab.refresh([edited]);
    selectionManager.setSelection([elsewhere], [elsewhere]);
    expect(panel.boundObjectsRead()).toEqual([edited]);
    const typedPositionX = edited.position.x + 4;
    panelPositionXType(panel, typedPositionX);
    expect(edited.position.x).toBeCloseTo(typedPositionX);
    expect(elsewhere.position.x).not.toBeCloseTo(typedPositionX);
    expect(commandStack.getUndoCount()).toBe(1);
    expect(panelStack.getUndoCount()).toBe(0);
    tab.deactivate();
    expect(panel.boundObjectsRead()).toEqual([elsewhere]);
    panelPositionXType(panel, typedPositionX);
    expect(panelStack.getUndoCount()).toBe(1);
    panel.dispose();
  });

  it('does nothing when the editor has no properties panel', () => {
    const { context } = objectPropertiesTestContextCreate([new THREE.Mesh()]);
    const tab = new TabObjectPropertiesProperties(context);
    expect(() => tab.refresh([])).not.toThrow();
    expect(context.container.childElementCount).toBe(0);
  });
});
