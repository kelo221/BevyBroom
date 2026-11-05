import type * as THREE from 'three';
import { CommandObjectClassChange } from '@/entity/class/commands/command_object_class_change.js';
import { type EntityClass, EntityClassPoint } from '@/entity/class/entity_class.js';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';
import { InputTextSuggest } from '@/ui/input/input_text_suggest.js';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { ObjectPropertiesTabSection } from '@/ui/object_properties/tabs/object_properties_tab_section.js';
import { filterUnlockedObjects } from '@/utils/object_lock.js';
import { ObjectPropertiesClassInfoChromePart } from './chrome/object_properties_class_info_chrome_part.js';

/**
 * Class part of the Class Info tab, Hammer's Class dropdown: a searchable combo
 * of the classes the edited objects may be, showing their current class.
 * Picking another class converts the objects in place as one edit.
 */
export class ObjectPropertiesClassInfoSectionClass extends ObjectPropertiesTabSection {
  private readonly combo: InputTextSuggest;
  private objects: readonly THREE.Object3D[];
  private classesFitting: EntityClass[];

  /**
   * Creates the class combo.
   *
   * @param context Tab context the class changes are pushed through.
   */
  constructor(context: ObjectPropertiesTabContext) {
    super(context, 'Class:', new ObjectPropertiesClassInfoChromePart());
    this.objects = [];
    this.classesFitting = [];
    this.combo = new InputTextSuggest('Class');
    this.combo.bindCommit(() => this.classCommit());
    this.element.appendChild(this.combo.getElement());
  }

  /**
   * Lists the classes every edited object may be and shows their shared class.
   *
   * @param objects Edited objects.
   */
  refresh(objects: readonly THREE.Object3D[]): void {
    this.objects = objects;
    this.classesFitting = ObjectPropertiesClassInfoSectionClass.classesFittingAll(objects);
    this.combo.suggestionsWrite(
      this.classesFitting.map((entityClass) => ({ value: entityClass.label, label: entityClass.category })),
    );
    this.combo.inputElementRead().disabled = this.classesFitting.length === 0;
    this.combo.setSharedValues(objects.map((object) => EntityClassRegistry.classOf(object)?.label ?? ''));
  }

  /** Converts the unlocked edited objects to the typed or picked class. */
  private classCommit(): void {
    const targetClass = this.classFindByText(this.combo.getValue());
    const command = targetClass ? new CommandObjectClassChange(filterUnlockedObjects(this.objects), targetClass) : null;
    if (!command?.hasChanges()) {
      this.refresh(this.objects);
      return;
    }
    this.commandPush(command);
  }

  /**
   * Finds the fitting class a typed text names: by label, ignoring case, else
   * by id.
   *
   * @param text Typed or picked text.
   * @returns The class, or null when none is named.
   */
  private classFindByText(text: string): EntityClass | null {
    const wanted = text.trim().toLowerCase();
    const byLabel = this.classesFitting.find((entityClass) => entityClass.label.toLowerCase() === wanted);
    return byLabel ?? this.classesFitting.find((entityClass) => entityClass.id.toLowerCase() === wanted) ?? null;
  }

  /**
   * Returns the classes every object may be converted into: the fitting classes
   * except point classes that are never placed on their own, such as data-only
   * game classes.
   *
   * @param objects Edited objects.
   * @returns Classes in display order; empty without objects.
   */
  private static classesFittingAll(objects: readonly THREE.Object3D[]): EntityClass[] {
    const [first, ...others] = objects;
    if (!first) {
      return [];
    }
    return EntityClassRegistry.classesFittingList(first).filter(
      (entityClass) =>
        ObjectPropertiesClassInfoSectionClass.classOfferedIs(entityClass) &&
        others.every((object) => entityClass.canApplyTo(object)),
    );
  }

  /**
   * Returns whether the combo offers converting into a class.
   *
   * @param entityClass Candidate class.
   * @returns False for point classes that are not placeable.
   */
  private static classOfferedIs(entityClass: EntityClass): boolean {
    return !(entityClass instanceof EntityClassPoint) || entityClass.placeableIs();
  }
}
