import { afterEach, describe, expect, it } from 'vitest';
import { PanelDataAssetEditor } from '@/game_entity/data_asset/ui/panel_data_asset_editor.js';
import { GameEntityFieldEditorChoice } from '@/game_entity/ui/fields/game_entity_field_editor_choice.js';
import { GameEntityFieldEditorDataAsset } from '@/game_entity/ui/fields/game_entity_field_editor_data_asset.js';
import { testDoorField } from '../../game_entity_test_classes.js';
import {
  testDataAssetGameCreate,
  testDoorStatsAssetType,
} from '../../data_asset/game_entity_data_asset_test_support.js';
import { editsCapture, elementChange } from './game_entity_field_editor_test_support.js';

/**
 * Asset fields of editable data asset types keep their path picker and add
 * buttons that edit the shared file or create a new one and reference it.
 */
describe('GameEntityFieldEditorDataAsset', () => {
  const panels: PanelDataAssetEditor[] = [];

  afterEach(() => {
    panels.splice(0).forEach((panel) => panel.dispose());
    document.body.replaceChildren();
  });

  /**
   * Creates the editor of the door stats field with its own panel.
   *
   * @returns Editor and panel.
   */
  function editorCreate(): { editor: GameEntityFieldEditorDataAsset; panel: PanelDataAssetEditor } {
    const { client } = testDataAssetGameCreate();
    const panel = new PanelDataAssetEditor(document.body, () => client);
    panels.push(panel);
    const assetType = testDoorStatsAssetType();
    const field = testDoorField('stats');
    const editor = new GameEntityFieldEditorDataAsset(
      field,
      assetType,
      new GameEntityFieldEditorChoice(field, assetType.paths),
      () => panel,
    );
    return { editor, panel };
  }

  /**
   * Returns a button of the editor by its tooltip start.
   *
   * @param editor Editor.
   * @param titleStart Start of the button title.
   * @returns Button.
   */
  function buttonOf(editor: GameEntityFieldEditorDataAsset, titleStart: string): HTMLButtonElement {
    const button = editor.getElement().querySelector<HTMLButtonElement>(`button[title^="${titleStart}"]`);
    if (!button) {
      throw new Error(`the editor has a ${titleStart} button`);
    }
    return button;
  }

  it('forwards path picks as edits', () => {
    const { editor } = editorCreate();
    const edits = editsCapture(editor);
    const path = testDoorStatsAssetType().paths[1] ?? '';
    elementChange(editor.getElement().querySelector('select'), path);
    expect(edits.map((edit) => edit(null))).toEqual([path]);
  });

  it('edits only a file every object shares', async () => {
    const { editor, panel } = editorCreate();
    const [firstPath, secondPath] = testDoorStatsAssetType().paths;
    editor.valuesShow([firstPath ?? '', secondPath ?? '']);
    expect(buttonOf(editor, 'Edit').disabled).toBe(true);
    editor.valuesShow([firstPath ?? '', firstPath ?? '']);
    buttonOf(editor, 'Edit').click();
    await panel.settled();
    expect(panel.isOpen()).toBe(true);
    expect(panel.getRootElement().textContent).toContain(firstPath ?? '');
  });

  it('references a newly created file', async () => {
    const { editor, panel } = editorCreate();
    const edits = editsCapture(editor);
    buttonOf(editor, 'New').click();
    const path = panel.createPathInputRead().value;
    panel.getRootElement().querySelector<HTMLButtonElement>('button[title="Create the data asset file"]')?.click();
    await panel.settled();
    expect(edits.map((edit) => edit(null))).toEqual([path]);
  });
});
