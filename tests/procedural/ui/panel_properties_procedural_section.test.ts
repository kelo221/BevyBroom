import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import {
  PROCEDURAL_GENERATOR_BOX_CORNER_B,
  PROCEDURAL_GENERATOR_BOX_SLOT_SURFACE,
} from '@/procedural/generator/box/procedural_generator_box.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { PanelPropertiesProceduralSection } from '@/procedural/ui/panel_properties_procedural_section.js';
import { PanelPropertiesSectionRegistry } from '@/ui/properties/panel_properties_section_registry.js';
import { getStateTexturePaint } from '@/texture/paint/state_texture_paint.js';

/**
 * Creates the section with plain chrome.
 *
 * @returns The section.
 */
function sectionCreate(): PanelPropertiesProceduralSection {
  return new PanelPropertiesProceduralSection(
    () => document.createElement('div'),
    (title) => {
      const header = document.createElement('h3');
      header.textContent = title;
      return header;
    },
  );
}

/**
 * Types a value into a field found by its accessible name and commits it.
 *
 * @param section Inspector section.
 * @param ariaLabel Accessible name.
 * @param value New value text.
 */
function fieldCommit(section: PanelPropertiesProceduralSection, ariaLabel: string, value: string): void {
  const field = section.getElement().querySelector(`[aria-label="${ariaLabel}"]`);
  if (!(field instanceof HTMLInputElement)) {
    throw new Error(`missing field ${ariaLabel}`);
  }
  field.value = value;
  field.dispatchEvent(new Event('change'));
}

/**
 * Returns the label of a box field.
 *
 * @param path Field path.
 * @returns Field label.
 */
function fieldLabelOf(path: string): string {
  const field = ProceduralGeneratorRegistry.find('box')
    ?.fields()
    .find((candidate) => candidate.path === path);
  if (!field) throw new Error(`missing field ${path}`);
  return field.label;
}

/** The inspector edits procedural parameters and textures with undo. */
describe('PanelPropertiesProceduralSection', () => {
  it('is a properties panel section shown only for procedural objects', () => {
    const sections = PanelPropertiesSectionRegistry.sectionsCreate({
      createSectionContainer: () => document.createElement('div'),
      createSectionHeader: () => document.createElement('h3'),
    });
    expect(sections.some((section) => section instanceof PanelPropertiesProceduralSection)).toBe(true);
    const section = sectionCreate();
    section.updateFromObjects([RoomOwner.createDefault('Hall')]);
    expect(section.getElement().style.display).toBe('none');
    section.updateFromObjects([ProceduralOwner.createDefault('Box')]);
    expect(section.getElement().style.display).toBe('block');
  });

  it('edits one coordinate of a point on every selected box as one undo step', () => {
    const stack = new CommandStack(8);
    const section = sectionCreate();
    const boxes = [ProceduralOwner.createDefault('A'), ProceduralOwner.createDefault('B')];
    const before = boxes.map((box) => ProceduralOwner.settingsRead(box));
    section.setCommandStack(stack);
    section.updateFromObjects(boxes);
    fieldCommit(section, `${fieldLabelOf(PROCEDURAL_GENERATOR_BOX_CORNER_B)} Y`, '3.5');
    for (const [index, box] of boxes.entries()) {
      const corner = ProceduralOwner.settingsRead(box)?.parameters[PROCEDURAL_GENERATOR_BOX_CORNER_B] as number[];
      const original = before[index]?.parameters[PROCEDURAL_GENERATOR_BOX_CORNER_B] as number[];
      expect(corner).toEqual([original[0], 3.5, original[2]]);
    }
    stack.undo();
    expect(boxes.map((box) => ProceduralOwner.settingsRead(box))).toEqual(before);
  });

  it('gives a slot the texture chosen in the texture browser', () => {
    const section = sectionCreate();
    const box = ProceduralOwner.createDefault('Box');
    section.updateFromObjects([box]);
    getStateTexturePaint().setLastTextureId('metal/plate');
    const button = section
      .getElement()
      .querySelector<HTMLButtonElement>('button[aria-label^="Use the texture browser"]');
    button?.click();
    expect(ProceduralOwner.settingsRead(box)?.materials[PROCEDURAL_GENERATOR_BOX_SLOT_SURFACE]).toBe('metal/plate');
  });

  it('explains when the selection mixes generators it cannot edit together', () => {
    const section = sectionCreate();
    const unknown = ProceduralOwner.create('Future', {
      generatorId: 'from_a_newer_editor',
      generatorVersion: 1,
      parameters: {},
      materials: {},
    });
    section.updateFromObjects([ProceduralOwner.createDefault('Box'), unknown]);
    expect(section.getElement().textContent).toContain('different generators');
    section.updateFromObjects([unknown]);
    expect(section.getElement().textContent).toContain('from_a_newer_editor');
  });
});
