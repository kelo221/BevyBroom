import type * as THREE from 'three';
import { Theme } from '@/theme.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { ObjectPropertiesTabSection } from '@/ui/object_properties/tabs/object_properties_tab_section.js';
import { CommandObjectComments } from '@/ui/object_properties/commands/command_object_comments.js';
import { listItemsIdentical } from '@/utils/utils_list.js';
import { ObjectPropertiesClassInfoChromePart } from './chrome/object_properties_class_info_chrome_part.js';

/** Placeholder shown while the edited objects carry different comments. */
const OBJECT_PROPERTIES_COMMENTS_MIXED_PLACEHOLDER = 'Mixed';

/**
 * Comments section of the Class Info tab: a text area for designer notes that
 * commits one undoable edit for every edited object when it loses focus.
 */
export class ObjectPropertiesClassInfoSectionComments extends ObjectPropertiesTabSection {
  private readonly textArea: HTMLTextAreaElement;
  private objects: readonly THREE.Object3D[];

  /**
   * Creates the comments section.
   *
   * @param context Tab context the comment edits are pushed through.
   */
  constructor(context: ObjectPropertiesTabContext) {
    super(context, 'Comments', new ObjectPropertiesClassInfoChromePart());
    this.objects = [];
    this.textArea = this.textAreaCreate();
    this.element.appendChild(this.textArea);
  }

  /**
   * Shows the shared comments, or an empty area with a mixed placeholder. Text
   * being typed for the same objects is left alone.
   *
   * @param objects Edited objects.
   */
  refresh(objects: readonly THREE.Object3D[]): void {
    if (this.isTypingForObjects(objects)) {
      return;
    }
    this.objects = objects;
    const commentsList = objects.map((object) => GameEntityLogicStore.commentsRead(object));
    const first = commentsList[0] ?? '';
    const mixed = commentsList.some((comments) => comments !== first);
    this.textArea.value = mixed ? '' : first;
    this.textArea.placeholder = mixed ? OBJECT_PROPERTIES_COMMENTS_MIXED_PLACEHOLDER : '';
  }

  /**
   * Returns whether the text area has focus while showing the given objects.
   *
   * @param objects Objects about to be shown.
   * @returns True while the user types comments for the same objects.
   */
  private isTypingForObjects(objects: readonly THREE.Object3D[]): boolean {
    const isFocused = this.textArea.ownerDocument.activeElement === this.textArea;
    return isFocused && listItemsIdentical(objects, this.objects);
  }

  /** Writes the typed comments onto every edited object as one edit. */
  private commentsCommit(): void {
    const command = new CommandObjectComments(this.objects, this.textArea.value);
    if (command.hasChanges()) {
      this.commandPush(command);
    }
  }

  /**
   * Creates the themed text area.
   *
   * @returns Text area element.
   */
  private textAreaCreate(): HTMLTextAreaElement {
    const textArea = document.createElement('textarea');
    textArea.setAttribute('aria-label', 'Comments');
    textArea.rows = 4;
    textArea.style.width = '100%';
    textArea.style.boxSizing = 'border-box';
    textArea.style.resize = 'vertical';
    textArea.style.background = Theme.inputBackgroundColor;
    textArea.style.color = Theme.inputTextColor;
    textArea.style.border = `1px solid ${Theme.inputBorderColor}`;
    textArea.style.fontFamily = Theme.uiFontFamily;
    textArea.style.fontSize = '12px';
    textArea.addEventListener('change', () => this.commentsCommit());
    return textArea;
  }
}
