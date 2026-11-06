import type * as THREE from 'three';
import { CommandObjectClassChange } from '@/entity/class/commands/command_object_class_change.js';
import type { EntityClass } from '@/entity/class/entity_class.js';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';
import { entityClassFindByText, entityClassesFittingAll } from '@/entity/class/entity_class_target_resolver.js';
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
    this.classesFitting = entityClassesFittingAll(objects);
    this.combo.suggestionsWrite(
      this.classesFitting.map((entityClass) => ({ value: entityClass.label, label: entityClass.category })),
    );
    this.combo.inputElementRead().disabled = this.classesFitting.length === 0;
    this.combo.setSharedValues(objects.map((object) => EntityClassRegistry.classOf(object)?.label ?? ''));
  }

  /** Converts the unlocked edited objects to the typed or picked class. */
  private classCommit(): void {
    const targetClass = entityClassFindByText(this.classesFitting, this.combo.getValue());
    const command = targetClass ? new CommandObjectClassChange(filterUnlockedObjects(this.objects), targetClass) : null;
    if (!command?.hasChanges()) {
      this.refresh(this.objects);
      return;
    }
    this.commandPush(command);
  }
}
