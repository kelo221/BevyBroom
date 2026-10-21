import { afterEach, describe, expect, it } from 'vitest';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import { gameEntityFieldEditorCreate } from '@/game_entity/ui/fields/game_entity_field_editor_factory.js';
import { GameEntityFieldEditorDataAsset } from '@/game_entity/ui/fields/game_entity_field_editor_data_asset.js';
import { GameEntityFieldEditorChoice } from '@/game_entity/ui/fields/game_entity_field_editor_choice.js';
import { GameEntityFieldEditorReadonly } from '@/game_entity/ui/fields/game_entity_field_editor_readonly.js';
import { GameEntityFieldEditorText } from '@/game_entity/ui/fields/game_entity_field_editor_text.js';
import {
  testClassListCreate,
  testClassesInstall,
  testDoorClassCreate,
  testDoorField,
} from '../../game_entity_test_classes.js';

/**
 * The factory picks an editor per field kind, shows unsupported fields and
 * fields of unknown classes read-only, and lists asset files when the game
 * reported them.
 */
describe('gameEntityFieldEditorCreate', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('creates an editable editor for every value field kind except unsupported', () => {
    for (const field of GameEntityComponentResolver.fieldsLeaf(testDoorClassCreate().fields)) {
      const editor = gameEntityFieldEditorCreate(field, true);
      expect(editor instanceof GameEntityFieldEditorReadonly).toBe(field.kind === 'unsupported');
    }
  });

  it('shows every field read-only when the class is not editable', () => {
    expect(gameEntityFieldEditorCreate(testDoorField('speed'), false)).toBeInstanceOf(GameEntityFieldEditorReadonly);
  });

  it('lists asset files the game reported and falls back to a path field', () => {
    expect(gameEntityFieldEditorCreate(testDoorField('stats'), true)).toBeInstanceOf(GameEntityFieldEditorText);
    const list = testClassListCreate();
    list.asset_types = list.asset_types.map((assetType) => ({ ...assetType, editable: false }));
    const { uninstall } = testClassesInstall(list);
    cleanups.push(uninstall);
    expect(gameEntityFieldEditorCreate(testDoorField('stats'), true)).toBeInstanceOf(GameEntityFieldEditorChoice);
  });

  it('adds data asset buttons to fields of editable asset types', () => {
    const { uninstall } = testClassesInstall();
    cleanups.push(uninstall);
    const editor = gameEntityFieldEditorCreate(testDoorField('stats'), true);
    expect(editor).toBeInstanceOf(GameEntityFieldEditorDataAsset);
    expect(editor.getElement().querySelector('select')).not.toBeNull();
  });

  it('shows read-only values as text and mixed values as Mixed', () => {
    const editor = gameEntityFieldEditorCreate(testDoorField('pending'), true);
    editor.valuesShow([{ a: 1 }]);
    expect(editor.getElement().textContent).toBe(JSON.stringify({ a: 1 }));
    editor.valuesShow([1, 2]);
    expect(editor.getElement().textContent).toBe('Mixed');
  });
});
