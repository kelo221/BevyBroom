import { describe, expect, it } from 'vitest';
import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityClassVariantNames } from '@/game_entity/class/game_entity_class_variant_names.js';
import { GameEntityFieldEditorEnumList } from '@/game_entity/ui/fields/game_entity_field_editor_enum_list.js';
import { gameEntityFieldEditorCreate } from '@/game_entity/ui/fields/game_entity_field_editor_factory.js';
import { TEST_SHELF_RUN_VARIANTS, testShelfRunClassCreate } from '../../game_entity_test_class_enum_list.js';
import { editsCapture, elementChange } from './game_entity_field_editor_test_support.js';

/**
 * Returns the enum list field of the test shelf run.
 *
 * @returns Field.
 */
function listFieldOf(): GameEntityField {
  const field = testShelfRunClassCreate().fields.find((candidate) => candidate.kind === 'enum_list');
  if (!field) {
    throw new Error('the shelf run has an enum list field');
  }
  return field;
}

/**
 * Returns the variant names of the rows an editor shows, in order.
 *
 * @param editor Enum list editor.
 * @returns Variant names.
 */
function rowVariants(editor: GameEntityFieldEditorEnumList): string[] {
  return [...editor.getElement().querySelectorAll<HTMLElement>('[data-enum-list-variant]')].map(
    (row) => row.dataset['enumListVariant'] ?? '',
  );
}

/**
 * Clicks the button of an editor with an accessible name.
 *
 * @param editor Enum list editor.
 * @param title Accessible name.
 */
function buttonClick(editor: GameEntityFieldEditorEnumList, title: string): void {
  const button = editor.getElement().querySelector<HTMLButtonElement>(`button[aria-label="${title}"]`);
  if (!button) {
    throw new Error(`the editor has the button ${title}`);
  }
  button.click();
}

/**
 * Enum list editors show the held variants in order, add one from a grouped
 * select, and move or remove each held one.
 */
describe('GameEntityFieldEditorEnumList', () => {
  const field = listFieldOf();
  const [first = '', second = '', third = ''] = TEST_SHELF_RUN_VARIANTS;
  const held = [first, second, third];

  it('is the editor the factory makes for enum list fields', () => {
    expect(gameEntityFieldEditorCreate(field, true)).toBeInstanceOf(GameEntityFieldEditorEnumList);
  });

  it('shows one numbered row per held variant by its display name', () => {
    const editor = new GameEntityFieldEditorEnumList(field);
    editor.valuesShow([held]);
    expect(rowVariants(editor)).toEqual(held);
    const secondLabel = GameEntityClassVariantNames.labelOf(field, second);
    expect(editor.getElement().textContent).toContain(`2. ${secondLabel}`);
  });

  it('adds a variant it does not hold from a select grouped like enum fields', () => {
    const editor = new GameEntityFieldEditorEnumList(field);
    const edits = editsCapture(editor);
    editor.valuesShow([held]);
    const select = editor.getElement().querySelector('select');
    const offered = [...(select?.options ?? [])].map((option) => option.value).filter((value) => value !== '');
    expect(offered.sort()).toEqual(TEST_SHELF_RUN_VARIANTS.filter((variant) => !held.includes(variant)).sort());
    const groups = [...(select?.querySelectorAll('optgroup') ?? [])].map((group) => group.label);
    const expectedGroups = offered.map((variant) => GameEntityClassVariantNames.groupOf(field, variant));
    expect(groups).toEqual([...new Set(expectedGroups.filter((group) => group !== null))]);
    const added = offered[0] ?? '';
    elementChange(select, added);
    expect(edits.map((edit) => edit(held))).toEqual([[...held, added]]);
  });

  it('moves a held variant up or down and removes it', () => {
    const editor = new GameEntityFieldEditorEnumList(field);
    const edits = editsCapture(editor);
    editor.valuesShow([held]);
    const labelOf = (variant: string): string => GameEntityClassVariantNames.labelOf(field, variant);
    buttonClick(editor, `Move ${labelOf(first)} down`);
    buttonClick(editor, `Move ${labelOf(third)} up`);
    buttonClick(editor, `Remove ${labelOf(second)}`);
    expect(edits.map((edit) => edit(held))).toEqual([
      [second, first, third],
      [first, third, second],
      [first, third],
    ]);
    expect(editor.getElement().querySelector(`button[aria-label="Move ${labelOf(first)} up"]`)).toBeNull();
  });

  it('marks unknown variants and notes when the objects hold different lists', () => {
    const editor = new GameEntityFieldEditorEnumList(field);
    const unknown = `unknown-${Math.floor(Math.random() * 1000)}`;
    editor.valuesShow([[first, unknown], [first]]);
    expect(rowVariants(editor)).toEqual([first, unknown]);
    expect(editor.getElement().textContent).toContain('(unknown)');
    expect(editor.getElement().textContent).toContain('Mixed');
  });

  it('applies an edit to each object’s own list', () => {
    const editor = new GameEntityFieldEditorEnumList(field);
    const edits = editsCapture(editor);
    editor.valuesShow([[first, second], [second]]);
    buttonClick(editor, `Remove ${GameEntityClassVariantNames.labelOf(field, second)}`);
    expect(edits.map((edit) => [edit([first, second]), edit([second])])).toEqual([[[first], []]]);
  });
});
