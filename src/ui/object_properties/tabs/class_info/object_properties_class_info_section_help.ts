import type * as THREE from 'three';
import { Theme } from '@/theme.js';
import type { EntityClass } from '@/entity/class/entity_class.js';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';
import { gameEntityClassIdOf } from '@/game_entity/class/game_entity_class_id.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import type { PreviewPlaceableIoPin } from '@/preview/protocol/preview_protocol_placeable_types.js';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { ObjectPropertiesTabSection } from '@/ui/object_properties/tabs/object_properties_tab_section.js';
import { ObjectPropertiesClassInfoChromePart } from './chrome/object_properties_class_info_chrome_part.js';
import type { ObjectPropertiesKeyvalueRowSelection } from './keyvalues/object_properties_keyvalue_row_selection.js';

/**
 * Help box of the Class Info tab: describes the class of the edited objects,
 * the keyvalue selected in the table, and the outputs and inputs of every game
 * class the objects carry.
 */
export class ObjectPropertiesClassInfoSectionHelp extends ObjectPropertiesTabSection {
  private readonly body: HTMLElement;
  private objects: readonly THREE.Object3D[];
  private selection: ObjectPropertiesKeyvalueRowSelection | null;

  /**
   * Creates the help box.
   *
   * @param context Tab context.
   */
  constructor(context: ObjectPropertiesTabContext) {
    super(context, 'Help', new ObjectPropertiesClassInfoChromePart());
    this.objects = [];
    this.selection = null;
    this.body = this.bodyCreate();
    this.element.appendChild(this.body);
  }

  /**
   * Describes the edited objects.
   *
   * @param objects Edited objects.
   */
  refresh(objects: readonly THREE.Object3D[]): void {
    this.objects = objects;
    this.render();
  }

  /**
   * Describes another selected keyvalue.
   *
   * @param selection Selected row, or null.
   */
  selectionWrite(selection: ObjectPropertiesKeyvalueRowSelection | null): void {
    this.selection = selection;
    this.render();
  }

  /**
   * Shows or hides the help box.
   *
   * @param isVisible True to show it.
   */
  visibleWrite(isVisible: boolean): void {
    this.element.hidden = !isVisible;
  }

  /**
   * Returns whether the help box is shown.
   *
   * @returns True while visible.
   */
  visibleRead(): boolean {
    return !this.element.hidden;
  }

  /**
   * Rebuilds the class, keyvalue and game class descriptions. A game class that
   * is the shared class itself is described once, in the class entry.
   */
  private render(): void {
    const sharedClass = this.sharedClassRead();
    const sharedClassId = sharedClass?.id ?? null;
    const typePaths = this.typePathsCarried().filter((typePath) => gameEntityClassIdOf(typePath) !== sharedClassId);
    this.body.replaceChildren(
      ...this.classEntryCreate(sharedClass),
      ...this.selectionEntryCreate(),
      ...typePaths.map((typePath) => this.gameClassEntryCreate(typePath)),
    );
  }

  /**
   * Returns the sorted type paths of the components any edited object carries.
   *
   * @returns Distinct type paths.
   */
  private typePathsCarried(): string[] {
    const typePaths = this.objects.flatMap((object) => Object.keys(GameEntityComponentStore.read(object)));
    return [...new Set(typePaths)].sort();
  }

  /**
   * Returns the class every edited object shares.
   *
   * @returns Shared class, or null when the classes differ or are unknown.
   */
  private sharedClassRead(): EntityClass | null {
    const classes = this.objects.map((object) => EntityClassRegistry.classOf(object));
    return this.classIdsCount() === 1 ? (classes[0] ?? null) : null;
  }

  /**
   * Counts the distinct classes of the edited objects, objects without a class
   * counting as one more.
   *
   * @returns Number of distinct classes.
   */
  private classIdsCount(): number {
    return new Set(this.objects.map((object) => EntityClassRegistry.classOf(object)?.id ?? null)).size;
  }

  /**
   * Describes the shared class of the edited objects, with the outputs and
   * inputs of the game class it stands for.
   *
   * @param entityClass Shared class, or null.
   * @returns Entry elements; one line for mixed or missing classes.
   */
  private classEntryCreate(entityClass: EntityClass | null): HTMLElement[] {
    if (!entityClass) {
      return [
        this.lineCreate(this.classIdsCount() > 1 ? 'The selected objects are of different classes.' : 'No class.'),
      ];
    }
    const classTypePath = this.typePathsCarried().find((typePath) => gameEntityClassIdOf(typePath) === entityClass.id);
    const entry = this.entryCreate();
    entry.dataset['helpClassId'] = entityClass.id;
    entry.append(
      this.titleCreate(`${entityClass.label} (${entityClass.category})`),
      this.lineCreate(entityClass.helpText),
      ...this.gameClassPinLinesCreate(classTypePath),
    );
    return [entry];
  }

  /**
   * Builds the output and input lines of a game class.
   *
   * @param typePath Component type path, or undefined for none.
   * @returns Line elements; none for unknown classes.
   */
  private gameClassPinLinesCreate(typePath: string | undefined): HTMLElement[] {
    const gameClass = typePath === undefined ? null : GameEntityClassRegistry.classFind(typePath);
    if (!gameClass) {
      return [];
    }
    return [...this.pinLinesCreate('Output', gameClass.outputs), ...this.pinLinesCreate('Input', gameClass.inputs)];
  }

  /**
   * Describes the keyvalue selected in the table.
   *
   * @returns Entry elements; none without a selection.
   */
  private selectionEntryCreate(): HTMLElement[] {
    if (!this.selection) {
      return [];
    }
    const entry = this.entryCreate();
    entry.dataset['helpKeyvalue'] = this.selection.captionRead();
    entry.append(this.titleCreate(this.selection.captionRead()), this.lineCreate(this.selection.helpTextRead()));
    return [entry];
  }

  /**
   * Describes one game class with its outputs and inputs.
   *
   * @param typePath Component type path.
   * @returns Entry element.
   */
  private gameClassEntryCreate(typePath: string): HTMLElement {
    const entry = this.entryCreate();
    entry.dataset['helpTypePath'] = typePath;
    const gameClass = GameEntityClassRegistry.classFind(typePath);
    if (!gameClass) {
      entry.append(this.titleCreate(typePath), this.lineCreate('Not reported by the game.'));
      return entry;
    }
    entry.append(
      this.titleCreate(`${gameClass.label} (${gameClass.category})`),
      this.lineCreate(typePath),
      ...this.gameClassPinLinesCreate(typePath),
    );
    return entry;
  }

  /**
   * Builds one line per pin with its description.
   *
   * @param kind Pin kind shown in front of the name.
   * @param pins Pins of the class, if any.
   * @returns Line elements.
   */
  private pinLinesCreate(kind: string, pins: GameEntityClass['inputs']): HTMLElement[] {
    return (pins ?? []).map((pin: PreviewPlaceableIoPin) =>
      this.lineCreate(pin.description ? `${kind} ${pin.name}: ${pin.description}` : `${kind} ${pin.name}`),
    );
  }

  /**
   * Creates the bordered, scrolling help text box.
   *
   * @returns Body element.
   */
  private bodyCreate(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'object-properties-class-help';
    body.style.color = Theme.statusBarTextColor;
    body.style.fontSize = '11px';
    body.style.lineHeight = '1.4';
    body.style.padding = '4px 6px';
    body.style.height = '120px';
    body.style.overflowY = 'auto';
    body.style.overflowX = 'hidden';
    body.style.overflowWrap = 'anywhere';
    body.style.wordBreak = 'break-word';
    body.style.whiteSpace = 'normal';
    body.style.boxSizing = 'border-box';
    body.style.fontFamily = Theme.uiFontFamily;
    body.style.border = `1px solid ${Theme.inputBorderColor}`;
    body.style.background = Theme.inputBackgroundColor;
    return body;
  }

  /**
   * Creates an empty entry with spacing below it.
   *
   * @returns Entry element.
   */
  private entryCreate(): HTMLElement {
    const entry = document.createElement('div');
    entry.style.marginBottom = '6px';
    return entry;
  }

  /**
   * Creates a bold title line.
   *
   * @param text Title text.
   * @returns Title element.
   */
  private titleCreate(text: string): HTMLElement {
    const title = this.lineCreate(text);
    title.style.color = Theme.buttonTextColor;
    title.style.fontWeight = '600';
    return title;
  }

  /**
   * Creates a plain text line.
   *
   * @param text Line text.
   * @returns Line element.
   */
  private lineCreate(text: string): HTMLElement {
    const line = document.createElement('div');
    line.textContent = text;
    return line;
  }
}
