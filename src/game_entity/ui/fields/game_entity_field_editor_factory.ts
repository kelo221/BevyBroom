import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import type { GameEntityFieldEditor } from '@/game_entity/ui/fields/game_entity_field_editor.js';
import { GameEntityFieldEditorBool } from '@/game_entity/ui/fields/game_entity_field_editor_bool.js';
import { GameEntityFieldEditorChoice } from '@/game_entity/ui/fields/game_entity_field_editor_choice.js';
import { GameEntityFieldEditorColor } from '@/game_entity/ui/fields/game_entity_field_editor_color.js';
import { GameEntityFieldEditorDataAsset } from '@/game_entity/ui/fields/game_entity_field_editor_data_asset.js';
import { GameEntityFieldEditorNumber } from '@/game_entity/ui/fields/game_entity_field_editor_number.js';
import { GameEntityFieldEditorPropertyMap } from '@/game_entity/ui/fields/game_entity_field_editor_property_map.js';
import { GameEntityFieldEditorReadonly } from '@/game_entity/ui/fields/game_entity_field_editor_readonly.js';
import { GameEntityFieldEditorText } from '@/game_entity/ui/fields/game_entity_field_editor_text.js';
import { GameEntityFieldEditorVector } from '@/game_entity/ui/fields/game_entity_field_editor_vector.js';
import type { PreviewPlaceableFieldKind } from '@/preview/protocol/preview_protocol_placeable_types.js';

/** Creates the editor of one field. */
type GameEntityFieldEditorConstructor = (field: GameEntityField) => GameEntityFieldEditor;

/** Editor constructor of every editable field kind. */
const GAME_ENTITY_FIELD_EDITORS: Partial<Record<PreviewPlaceableFieldKind, GameEntityFieldEditorConstructor>> = {
  number: (field) => new GameEntityFieldEditorNumber(field),
  integer: (field) => new GameEntityFieldEditorNumber(field),
  bool: (field) => new GameEntityFieldEditorBool(field),
  text: (field) => new GameEntityFieldEditorText(field),
  vector2: (field) => new GameEntityFieldEditorVector(field),
  vector3: (field) => new GameEntityFieldEditorVector(field),
  vector4: (field) => new GameEntityFieldEditorVector(field),
  color: (field) => new GameEntityFieldEditorColor(field),
  enum: (field) => new GameEntityFieldEditorChoice(field, field.variants ?? []),
  asset: gameEntityFieldEditorAssetCreate,
  property_map: (field) => new GameEntityFieldEditorPropertyMap(field),
};

/**
 * Creates the editor of a field.
 *
 * @param field Field description.
 * @param editable False to show the value read-only, as for classes the game
 *   does not report.
 * @returns Field editor.
 */
export function gameEntityFieldEditorCreate(field: GameEntityField, editable: boolean): GameEntityFieldEditor {
  const create = editable ? GAME_ENTITY_FIELD_EDITORS[field.kind] : undefined;
  return create ? create(field) : new GameEntityFieldEditorReadonly(field);
}

/**
 * Creates the editor of an asset field: a pick list of the files the game
 * reported, or a path field when it reported none. Fields of editable data
 * asset types also get buttons that edit and create files.
 *
 * @param field Asset field.
 * @returns Field editor.
 */
function gameEntityFieldEditorAssetCreate(field: GameEntityField): GameEntityFieldEditor {
  const assetType = field.asset_type ? GameEntityClassRegistry.assetTypeFind(field.asset_type) : null;
  const pathEditor =
    !assetType || assetType.paths.length === 0
      ? new GameEntityFieldEditorText(field)
      : new GameEntityFieldEditorChoice(field, assetType.paths);
  return assetType?.editable ? new GameEntityFieldEditorDataAsset(field, assetType, pathEditor) : pathEditor;
}
