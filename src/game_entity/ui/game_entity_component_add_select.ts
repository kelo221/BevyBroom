import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentsEdit } from '@/game_entity/component/game_entity_components_edit.js';
import type { GameEntityComponentsCommit } from '@/game_entity/ui/game_entity_component_block.js';
import { InputSelect, type InputSelectChoice } from '@/ui/input/input_select.js';
import { panelPropertiesRowCreate } from '@/ui/properties/panel_properties_row.js';

/** Label of the select's resting entry. */
const GAME_ENTITY_ADD_SELECT_PROMPT = 'Add component…';

/**
 * Select that attaches a component class to every bound object. It offers the
 * classes not every object carries yet; classes meant for game entities only
 * appear when every bound object is a game entity.
 */
export class GameEntityComponentAddSelect {
  private readonly row: HTMLElement;

  /**
   * Creates the select row.
   *
   * @param attachedTypePaths Type paths every bound object carries.
   * @param pointsOnly Whether every bound object is a game entity.
   * @param commit Applies an edit to every bound object.
   */
  constructor(attachedTypePaths: readonly string[], pointsOnly: boolean, commit: GameEntityComponentsCommit) {
    const offered = GameEntityComponentAddSelect.classesOffered(attachedTypePaths, pointsOnly);
    const input = new InputSelect(GameEntityComponentAddSelect.choicesCreate(offered), 'Add game component');
    input.setSharedValues(['']);
    input.bindCommit(() => {
      const typePath = input.getValue();
      if (typePath !== '') {
        commit((components) => GameEntityComponentsEdit.componentAdd(components, typePath));
      }
    });
    this.row = panelPropertiesRowCreate('Add', input);
  }

  /**
   * Returns the row element.
   *
   * @returns Row element.
   */
  getElement(): HTMLElement {
    return this.row;
  }

  /**
   * Returns the classes that may still be attached.
   *
   * @param attachedTypePaths Type paths every bound object carries.
   * @param pointsOnly Whether every bound object is a game entity.
   * @returns Offered classes.
   */
  static classesOffered(attachedTypePaths: readonly string[], pointsOnly: boolean): GameEntityClass[] {
    return GameEntityClassRegistry.classesList().filter(
      (gameClass) =>
        !attachedTypePaths.includes(gameClass.type_path) && (pointsOnly || gameClass.placement !== 'point'),
    );
  }

  /**
   * Creates the select entries: the prompt and one entry per class.
   *
   * @param classes Offered classes.
   * @returns Select entries.
   */
  private static choicesCreate(classes: readonly GameEntityClass[]): InputSelectChoice[] {
    return [
      { value: '', label: GAME_ENTITY_ADD_SELECT_PROMPT },
      ...classes.map((gameClass) => ({
        value: gameClass.type_path,
        label: `${gameClass.category} / ${gameClass.label}`,
        title: gameClass.type_path,
      })),
    ];
  }
}
