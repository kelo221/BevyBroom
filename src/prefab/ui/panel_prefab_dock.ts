import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import type { UndoCommand } from '@/commands/command_undo.js';
import { CommandPrimitiveCreate } from '@/tools/creation/commands/command_primitive_create.js';
import {
  SHELL_DOCK_COMPACT_GAP_PX,
  shellDockCompactButtonCreate,
  shellDockCompactFieldStyle,
  shellDockCompactRowStyle,
} from '@/layout/shell/dock/shell_dock_compact.js';
import { InputWheelBindingSelect } from '@/ui/input/wheel/input_wheel_binding_select.js';
import { getPrefabCatalogStore, type PrefabCatalogStore } from '../prefab_catalog_store.js';
import { CommandPrefabTemplateAdd } from '../commands/command_prefab_template_add.js';
import { CommandPrefabEntityTie } from '../commands/command_prefab_entity_tie.js';
import { CommandPrefabEntityWorldMove } from '../commands/command_prefab_entity_world_move.js';

/** Width of the row captions such as `Move selected:` in pixels. */
const PANEL_PREFAB_DOCK_CAPTION_WIDTH_PX = 84;

/** Callbacks linking `PanelPrefabDock` to the live scene, selection and history. */
export interface PanelPrefabDockHandlers {
  /** Reads the currently selected scene objects. */
  selectedObjectsRead: () => THREE.Object3D[];
  /** Returns the parent container for newly stamped prefabs or entity groups. */
  worldRootRead: () => THREE.Object3D;
  /** Records and runs an undoable command, then refreshes the editor. */
  commandRun: (command: UndoCommand) => void;
}

/**
 * Hammer++ right-dock `Categories / Objects` Prefab picker, `Insert Original
 * Prefab`, `Create Prefab`, and `toWorld` / `toEntity` controls.
 */
export class PanelPrefabDock {
  private readonly root: HTMLElement;
  private readonly store: PrefabCatalogStore;
  private readonly handlers: PanelPrefabDockHandlers;
  private readonly categorySelect: HTMLSelectElement;
  private readonly objectSelect: HTMLSelectElement;
  private readonly nameInput: HTMLInputElement;
  private readonly selectWheelBindings: readonly InputWheelBindingSelect[];
  private readonly unsubscribeStore: () => void;

  /**
   * Creates the Prefab & `toWorld`/`toEntity` dock strip.
   *
   * @param parent Container element.
   * @param handlers Scene, selection and history callbacks.
   * @param store Optional PrefabCatalogStore (defaults to shared singleton).
   */
  constructor(
    parent: HTMLElement,
    handlers: PanelPrefabDockHandlers,
    store: PrefabCatalogStore = getPrefabCatalogStore(),
  ) {
    const doc = parent.ownerDocument;
    this.store = store;
    this.handlers = handlers;
    this.root = doc.createElement('div');
    this.categorySelect = doc.createElement('select');
    this.objectSelect = doc.createElement('select');
    this.nameInput = doc.createElement('input');
    this.selectWheelBindings = [this.categorySelect, this.objectSelect].map(
      (select) => new InputWheelBindingSelect(select),
    );
    this.buildLayout(doc);
    parent.appendChild(this.root);
    this.unsubscribeStore = this.storeSyncStart();
  }

  /**
   * Fills the selectors from the store and keeps them in sync with its changes.
   *
   * @returns Function that stops listening to the store.
   */
  private storeSyncStart(): () => void {
    const unsubscribe = this.store.changeListenerAdd(() => this.syncSelectors());
    this.syncSelectors();
    return unsubscribe;
  }

  /**
   * Returns the root DOM element.
   *
   * @returns Root element.
   */
  elementRead(): HTMLElement {
    return this.root;
  }

  /** Disposes store and wheel listeners and removes the panel from the DOM. */
  dispose(): void {
    this.unsubscribeStore();
    this.selectWheelBindings.forEach((binding) => binding.dispose());
    this.root.remove();
  }

  /**
   * Builds the Categories/Objects selectors, Create Prefab row, and
   * toEntity/toWorld buttons.
   *
   * @param doc Owner document.
   */
  private buildLayout(doc: Document): void {
    this.root.className = 'panel-prefab-dock';
    this.root.style.display = 'flex';
    this.root.style.flexDirection = 'column';
    this.root.style.gap = `${SHELL_DOCK_COMPACT_GAP_PX}px`;
    this.root.style.padding = `${SHELL_DOCK_COMPACT_GAP_PX}px`;
    this.root.style.background = hexToRgb(Theme.propertiesPanelBackground);
    this.root.style.borderBottom = `1px solid ${hexToRgb(Theme.separatorColor)}`;
    this.categorySelect.className = 'panel-prefab-category-select';
    this.objectSelect.className = 'panel-prefab-object-select';
    this.categorySelect.addEventListener('change', () => this.syncObjectOptions());
    this.root.append(
      this.buildEntityConvertRow(doc),
      this.buildSelectorRow(doc, 'Categories:', this.categorySelect),
      this.buildSelectorRow(doc, 'Objects:', this.objectSelect),
      this.buildPrefabActionRow(doc),
    );
  }

  /**
   * Creates a muted row caption.
   *
   * @param doc Owner document.
   * @param labelText Caption text.
   * @returns Caption element.
   */
  private buildRowCaption(doc: Document, labelText: string): HTMLElement {
    const label = doc.createElement('span');
    label.textContent = labelText;
    label.style.fontSize = `${Theme.uiFontSizePx}px`;
    label.style.fontFamily = Theme.uiFontFamily;
    label.style.color = Theme.statusBarTextColor;
    label.style.whiteSpace = 'nowrap';
    label.style.flex = `0 0 ${PANEL_PREFAB_DOCK_CAPTION_WIDTH_PX}px`;
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.title = labelText;
    return label;
  }

  /**
   * Creates a wrapping row of compact controls.
   *
   * @param doc Owner document.
   * @returns Row element.
   */
  private buildRow(doc: Document): HTMLElement {
    const row = doc.createElement('div');
    shellDockCompactRowStyle(row);
    return row;
  }

  /**
   * Builds one labeled `<select>` row.
   *
   * @param doc Owner document.
   * @param labelText Label text.
   * @param select Select element.
   * @returns Row element.
   */
  private buildSelectorRow(doc: Document, labelText: string, select: HTMLSelectElement): HTMLElement {
    const row = this.buildRow(doc);
    const label = this.buildRowCaption(doc, labelText);
    shellDockCompactFieldStyle(select);
    select.style.background = Theme.inputBackgroundColor;
    select.style.color = Theme.inputTextColor;
    select.style.border = `1px solid ${Theme.inputBorderColor}`;
    select.style.borderRadius = `${Theme.controlRadiusPx}px`;
    row.append(label, select);
    return row;
  }

  /**
   * Builds the `Insert Original Prefab` and `Create Prefab` row.
   *
   * @param doc Owner document.
   * @returns Row element.
   */
  private buildPrefabActionRow(doc: Document): HTMLElement {
    const row = this.buildRow(doc);
    this.nameInputStyle();
    const insertBtn = this.createButton('Insert', 'panel-prefab-insert', () => this.onInsertPrefab());
    insertBtn.title = 'Insert the chosen prefab';
    const createBtn = this.createButton('Create Prefab', 'panel-prefab-create', () => this.onCreatePrefab());
    row.append(this.nameInput, insertBtn, createBtn);
    return row;
  }

  /**
   * Styles the prefab name field as a compact text input on its own line above
   * the prefab buttons.
   */
  private nameInputStyle(): void {
    const input = this.nameInput;
    input.type = 'text';
    input.placeholder = 'Prefab name…';
    input.className = 'panel-prefab-name-input';
    shellDockCompactFieldStyle(input);
    input.style.flex = '1 1 100%';
    input.style.background = Theme.inputBackgroundColor;
    input.style.color = Theme.inputTextColor;
    input.style.border = `1px solid ${Theme.inputBorderColor}`;
    input.style.borderRadius = `${Theme.controlRadiusPx}px`;
    input.style.padding = '0 4px';
  }

  /**
   * Builds the `Move selected:` row with the `toWorld` and `toEntity` buttons.
   *
   * @param doc Owner document.
   * @returns Row element.
   */
  private buildEntityConvertRow(doc: Document): HTMLElement {
    const row = this.buildRow(doc);
    row.className = 'panel-prefab-move-selected';
    row.append(
      this.buildRowCaption(doc, 'Move selected:'),
      this.createButton('toWorld', 'panel-prefab-to-world', () => this.onMoveToWorld()),
      this.createButton('toEntity', 'panel-prefab-to-entity', () => this.onTieToEntity()),
    );
    return row;
  }

  /**
   * Creates a compact action button.
   *
   * @param label Button label.
   * @param className Class name identifying the action.
   * @param onClick Click callback.
   * @returns Button element.
   */
  private createButton(label: string, className: string, onClick: () => void): HTMLButtonElement {
    const button = shellDockCompactButtonCreate(label, onClick);
    button.classList.add(className);
    return button;
  }

  /**
   * Stamps the selected prefab template into the world root as one undoable
   * step.
   */
  private onInsertPrefab(): void {
    const id = this.objectSelect.value;
    if (!id) return;
    const stamped = this.store.stampTemplate(id, new THREE.Vector3(0, 0, 0), true);
    if (!stamped) return;
    this.handlers.commandRun(new CommandPrimitiveCreate(stamped, this.handlers.worldRootRead()));
  }

  /**
   * Captures the current selection as a new prefab in the active category as
   * one undoable step.
   */
  private onCreatePrefab(): void {
    const selected = this.handlers.selectedObjectsRead();
    if (selected.length === 0) return;
    const name = this.nameInput.value.trim() || `Prefab ${this.store.categoriesRead().length}`;
    const category = this.categorySelect.value || 'Prefabs';
    const templateAdd = new CommandPrefabTemplateAdd(this.store, this.store.templateCapture(name, category, selected));
    this.handlers.commandRun(templateAdd);
    this.categorySelect.value = templateAdd.templateRead().category;
    this.syncObjectOptions();
    this.objectSelect.value = templateAdd.templateRead().id;
  }

  /**
   * Ties the current selection to a brush entity (`toEntity`) as one undoable
   * step.
   */
  private onTieToEntity(): void {
    const tie = CommandPrefabEntityTie.create(this.handlers.selectedObjectsRead(), this.handlers.worldRootRead());
    if (tie) {
      this.handlers.commandRun(tie);
    }
  }

  /**
   * Moves the selected entity groups back to world geometry (`toWorld`) as one
   * undoable step.
   */
  private onMoveToWorld(): void {
    const worldMove = CommandPrefabEntityWorldMove.create(this.handlers.selectedObjectsRead());
    if (worldMove) {
      this.handlers.commandRun(worldMove);
    }
  }

  /**
   * Synchronizes category and object `<select>` elements from
   * `PrefabCatalogStore`.
   */
  private syncSelectors(): void {
    const categories = this.store.categoriesRead();
    const prevCat = this.categorySelect.value;
    this.categorySelect.replaceChildren();
    for (const cat of categories) {
      const opt = this.categorySelect.ownerDocument.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      this.categorySelect.appendChild(opt);
    }
    this.categorySelect.value = categories.includes(prevCat) ? prevCat : (categories[0] ?? 'Prefabs');
    this.syncObjectOptions();
  }

  /** Populates the `Objects:` dropdown for the selected category. */
  private syncObjectOptions(): void {
    const templates = this.store.templatesByCategoryRead(this.categorySelect.value);
    this.objectSelect.replaceChildren();
    for (const tpl of templates) {
      const opt = this.objectSelect.ownerDocument.createElement('option');
      opt.value = tpl.id;
      opt.textContent = tpl.name;
      this.objectSelect.appendChild(opt);
    }
  }
}
