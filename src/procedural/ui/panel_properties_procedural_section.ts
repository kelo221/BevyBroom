import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityUiChrome } from '@/game_entity/ui/game_entity_ui_chrome.js';
import type { GameEntityFieldEdit } from '@/game_entity/ui/fields/game_entity_field_editor.js';
import { gameEntityFieldEditorCreate } from '@/game_entity/ui/fields/game_entity_field_editor_factory.js';
import type { ProceduralGenerator, ProceduralMaterialSlot } from '@/procedural/generator/procedural_generator.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';
import { getStateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import { PanelPropertiesEntitySection } from '@/ui/properties/panel_properties_entity_section.js';
import { panelPropertiesRowFieldStretch } from '@/ui/properties/panel_properties_row.js';

/**
 * Inspector section for procedural objects: the generator, one editor per
 * generator field and the texture of every material slot. It edits the selected
 * objects together when they share a generator.
 */
export class PanelPropertiesProceduralSection extends PanelPropertiesEntitySection<ProceduralSettings> {
  private readonly body: HTMLElement;

  /**
   * Creates the section.
   *
   * @param createSectionContainer Section chrome factory.
   * @param createSectionHeader Header factory.
   */
  constructor(createSectionContainer: () => HTMLElement, createSectionHeader: (title: string) => HTMLElement) {
    super(ProceduralOwner, 'Procedural', createSectionContainer, createSectionHeader);
    this.body = document.createElement('div');
    this.section.appendChild(this.body);
  }

  /** Rebuilds the rows for the bound objects. */
  protected fieldsWrite(): void {
    this.body.replaceChildren();
    const settingsList = this.settingsListRead();
    const generator = PanelPropertiesProceduralSection.sharedGeneratorOf(settingsList);
    if (generator === null) {
      this.body.appendChild(GameEntityUiChrome.noteCreate(PanelPropertiesProceduralSection.noteTextOf(settingsList)));
      return;
    }
    this.body.appendChild(GameEntityUiChrome.infoRowCreate('Generator', generator.label, generator.generatorId));
    generator.fields().forEach((field) => this.body.appendChild(this.parameterRowCreate(field, settingsList)));
    generator.materialSlots().forEach((slot) => this.body.appendChild(this.materialRowCreate(slot, settingsList)));
  }

  /**
   * Creates the row editing one generator field.
   *
   * @param field Field description.
   * @param settingsList Settings of the bound objects.
   * @returns Row element.
   */
  private parameterRowCreate(field: GameEntityField, settingsList: readonly ProceduralSettings[]): HTMLElement {
    const editor = gameEntityFieldEditorCreate(field, true);
    editor.valuesShow(settingsList.map((settings) => settings.parameters[field.path] ?? field.default));
    editor.bindCommit((edit) => this.parameterCommit(field, edit));
    return GameEntityUiChrome.fieldRowCreate(
      field,
      0,
      false,
      panelPropertiesRowFieldStretch(editor.getElement()),
      null,
    );
  }

  /**
   * Applies an edit of one field to every bound object as one undo step.
   *
   * @param field Edited field.
   * @param edit Turns an object's current value into its new value.
   */
  private parameterCommit(field: GameEntityField, edit: GameEntityFieldEdit): void {
    this.settingsCommit((settings) => ({
      ...settings,
      parameters: {
        ...settings.parameters,
        [field.path]: edit(
          settings.parameters[field.path] ?? field.default,
        ) as ProceduralSettings['parameters'][string],
      },
    }));
  }

  /**
   * Creates the row showing a material slot's texture, with a button that gives
   * the slot the texture chosen in the texture browser.
   *
   * @param slot Material slot.
   * @param settingsList Settings of the bound objects.
   * @returns Row element.
   */
  private materialRowCreate(slot: ProceduralMaterialSlot, settingsList: readonly ProceduralSettings[]): HTMLElement {
    const field: GameEntityField = { path: slot.name, label: `${slot.label} Texture`, kind: 'text', default: '' };
    const editor = gameEntityFieldEditorCreate(field, true);
    editor.valuesShow(settingsList.map((settings) => settings.materials[slot.name] ?? ''));
    editor.bindCommit((edit) => this.materialCommit(slot, (current) => String(edit(current))));
    const apply = GameEntityUiChrome.iconButtonCreate('⇦', `Use the texture browser's texture for ${slot.label}`, () =>
      this.materialCommit(slot, () => getStateTexturePaint().getLastTextureId()),
    );
    return GameEntityUiChrome.fieldRowCreate(
      field,
      0,
      false,
      panelPropertiesRowFieldStretch(editor.getElement()),
      apply,
    );
  }

  /**
   * Changes the texture of one material slot on every bound object as one undo
   * step.
   *
   * @param slot Material slot.
   * @param textureOf Turns an object's current texture into its new texture.
   */
  private materialCommit(slot: ProceduralMaterialSlot, textureOf: (current: string) => string): void {
    this.settingsCommit((settings) => ({
      ...settings,
      materials: { ...settings.materials, [slot.name]: textureOf(settings.materials[slot.name] ?? '') },
    }));
  }

  /**
   * Returns the generator every object uses.
   *
   * @param settingsList Settings of the bound objects.
   * @returns The shared known generator, or null when they differ or it is
   *   unknown.
   */
  private static sharedGeneratorOf(settingsList: readonly ProceduralSettings[]): ProceduralGenerator | null {
    const generatorId = settingsList[0]?.generatorId;
    if (generatorId === undefined || settingsList.some((settings) => settings.generatorId !== generatorId)) {
      return null;
    }
    return ProceduralGeneratorRegistry.find(generatorId);
  }

  /**
   * Explains why no fields are shown.
   *
   * @param settingsList Settings of the bound objects.
   * @returns Note text.
   */
  private static noteTextOf(settingsList: readonly ProceduralSettings[]): string {
    const generatorIds = new Set(settingsList.map((settings) => settings.generatorId));
    if (generatorIds.size > 1) {
      return 'The selected objects use different generators.';
    }
    return `Generator ${[...generatorIds].join('')} is not known to this editor; its parameters are kept as they are.`;
  }
}
