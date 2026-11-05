import type * as THREE from 'three';
import { buttonCompactCreate, buttonCompactEnabledWrite } from '@/ui/button/button_compact.js';
import { ObjectPropertiesComponentClipboard } from '@/ui/object_properties/clipboard/object_properties_component_clipboard.js';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { ObjectPropertiesTabSection } from '@/ui/object_properties/tabs/object_properties_tab_section.js';
import { ObjectPropertiesClassInfoChromePart } from './chrome/object_properties_class_info_chrome_part.js';
import type { ObjectPropertiesKeyvalueRowSelection } from './keyvalues/object_properties_keyvalue_row_selection.js';
import { ObjectPropertiesKeyvalueTable } from './keyvalues/object_properties_keyvalue_table.js';
import type { ObjectPropertiesKeyvaluesView } from './keyvalues/views/object_properties_keyvalues_view.js';
import { ObjectPropertiesKeyvaluesViewRaw } from './keyvalues/views/object_properties_keyvalues_view_raw.js';
import { ObjectPropertiesKeyvaluesViewSmart } from './keyvalues/views/object_properties_keyvalues_view_smart.js';

/**
 * Keyvalues part of the Class Info tab: the Property Name | Value table with
 * field editors while SmartEdit is on and plain text while it is off, and the
 * small Copy and Paste buttons that copy game components between objects.
 */
export class ObjectPropertiesClassInfoSectionKeyvalues extends ObjectPropertiesTabSection {
  private readonly table: ObjectPropertiesKeyvalueTable;
  private readonly smartView: ObjectPropertiesKeyvaluesView;
  private readonly rawView: ObjectPropertiesKeyvaluesView;
  private readonly clipboard: ObjectPropertiesComponentClipboard;
  private readonly pasteButton: HTMLButtonElement;
  private view: ObjectPropertiesKeyvaluesView;
  private objects: readonly THREE.Object3D[];

  /**
   * Creates the keyvalues part with SmartEdit on.
   *
   * @param context Tab context edits are pushed through.
   * @param onSelectionChange Called with the selected row, or null.
   */
  constructor(
    context: ObjectPropertiesTabContext,
    onSelectionChange: (selection: ObjectPropertiesKeyvalueRowSelection | null) => void,
  ) {
    super(context, 'Keyvalues:', new ObjectPropertiesClassInfoChromePart());
    this.objects = [];
    this.clipboard = new ObjectPropertiesComponentClipboard();
    this.table = new ObjectPropertiesKeyvalueTable(onSelectionChange);
    this.smartView = new ObjectPropertiesKeyvaluesViewSmart(context);
    this.rawView = new ObjectPropertiesKeyvaluesViewRaw(context);
    this.view = this.smartView;
    this.pasteButton = this.clipboardButtonCreate('Paste', 'paste', () => this.componentsPaste());
    this.headerButtonsAppend();
    this.pasteButtonEnabledWrite();
    this.element.style.flex = '1 1 auto';
    this.element.appendChild(this.table.getElement());
    this.table.contentWrite(this.view.contentRead());
  }

  /**
   * Shows the keyvalues of the edited objects.
   *
   * @param objects Edited objects.
   */
  refresh(objects: readonly THREE.Object3D[]): void {
    this.objects = objects;
    this.view.refresh(objects);
    this.table.rowsDecorate();
    this.pasteButtonEnabledWrite();
  }

  /**
   * Returns whether field editors are shown.
   *
   * @returns True while SmartEdit is on.
   */
  smartEditRead(): boolean {
    return this.view === this.smartView;
  }

  /**
   * Switches between field editors and plain text.
   *
   * @param isSmartEdit True for field editors.
   */
  smartEditWrite(isSmartEdit: boolean): void {
    this.view = isSmartEdit ? this.smartView : this.rawView;
    this.table.contentWrite(this.view.contentRead());
    this.refresh(this.objects);
  }

  /** Puts Copy and Paste on the caption line. */
  private headerButtonsAppend(): void {
    const caption = this.element.firstElementChild;
    const copyButton = this.clipboardButtonCreate('Copy', 'copy', () => this.componentsCopy());
    copyButton.title = 'Copy the game components of the first selected object';
    this.pasteButton.title = 'Paste the copied game components onto every selected object';
    const bar = document.createElement('div');
    bar.style.display = 'flex';
    bar.style.alignItems = 'center';
    bar.style.gap = '4px';
    if (caption instanceof HTMLElement) {
      caption.style.flex = '1';
      bar.appendChild(caption);
    }
    bar.append(copyButton, this.pasteButton);
    this.element.prepend(bar);
  }

  /**
   * Creates one small clipboard button.
   *
   * @param text Button text.
   * @param action Action name stored on the button for lookups.
   * @param onClick Click handler.
   * @returns Button element.
   */
  private clipboardButtonCreate(text: string, action: string, onClick: () => void): HTMLButtonElement {
    const button = buttonCompactCreate({ title: text, text, widthPx: null, heightPx: 18, onClick });
    button.dataset['objectPropertiesAction'] = action;
    return button;
  }

  /** Enables Paste only after something was copied. */
  private pasteButtonEnabledWrite(): void {
    buttonCompactEnabledWrite(this.pasteButton, this.clipboard.hasContent());
  }

  /** Copies the game components of the first edited object. */
  private componentsCopy(): void {
    const first = this.objects[0];
    if (first) {
      this.clipboard.copy(first);
      this.pasteButtonEnabledWrite();
    }
  }

  /** Pastes the copied game components onto every edited object. */
  private componentsPaste(): void {
    const command = this.clipboard.pasteCommandCreate(this.objects);
    if (command) {
      this.commandPush(command);
    }
  }
}
