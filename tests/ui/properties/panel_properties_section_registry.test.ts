import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { PanelPropertiesSolidBrushSection } from '@/ui/properties/panel_properties_solid_brush_section.js';
import { PanelPropertiesSectionRegistry } from '@/ui/properties/panel_properties_section_registry.js';
import type {
  PanelPropertiesSection,
  PanelPropertiesSectionFactory,
} from '@/ui/properties/panel_properties_section.js';
import { CommandStack } from '@/commands/command_stack.js';

/** Inspector section that records what the host forwards to it. */
class RecordingSection implements PanelPropertiesSection {
  readonly element = document.createElement('section');
  readonly selections: number[] = [];
  stack: CommandStack | null = null;

  /**
   * Returns the section element.
   *
   * @returns Section root.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Records the forwarded stack.
   *
   * @param stack Command stack.
   */
  setCommandStack(stack: CommandStack | null): void {
    this.stack = stack;
  }

  /**
   * Records the forwarded selection size.
   *
   * @param objects Selection.
   */
  updateFromObjects(objects: readonly THREE.Object3D[]): void {
    this.selections.push(objects.length);
  }
}

/**
 * Creates a solid brush section host with plain chrome.
 *
 * @returns Host section.
 */
function hostCreate(): PanelPropertiesSolidBrushSection {
  return new PanelPropertiesSolidBrushSection(
    Theme,
    () => document.createElement('div'),
    (title) => {
      const header = document.createElement('h3');
      header.textContent = title;
      return header;
    },
    () => 'rgb(0, 0, 0)',
  );
}

/** Registered inspector sections are mounted and fed by the properties panel. */
describe('PanelPropertiesSectionRegistry', () => {
  const created: RecordingSection[] = [];
  const factory: PanelPropertiesSectionFactory = () => {
    const section = new RecordingSection();
    created.push(section);
    return section;
  };

  afterEach(() => {
    PanelPropertiesSectionRegistry.unregister(factory);
    created.length = 0;
  });

  it('mounts a registered section and forwards the stack and selection to it', () => {
    PanelPropertiesSectionRegistry.register(factory);
    const host = hostCreate();
    const section = created[0];
    if (!section) throw new Error('section was not created');
    expect(host.getElement().contains(section.element)).toBe(true);
    const stack = new CommandStack(4);
    host.setCommandStack(stack);
    host.updateFromObjects([new THREE.Group(), new THREE.Group()]);
    expect(section.stack).toBe(stack);
    expect(section.selections).toEqual([2]);
  });

  it('does not create a section once it is unregistered', () => {
    PanelPropertiesSectionRegistry.register(factory);
    PanelPropertiesSectionRegistry.unregister(factory);
    hostCreate();
    expect(created).toHaveLength(0);
  });
});
