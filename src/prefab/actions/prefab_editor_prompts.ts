import {
  showPromptFields,
  type DialogPromptAnswer,
  type DialogPromptField,
  type DialogPromptFieldsOptions,
} from '@/ui/dialog/dialog_prompt_fields.js';
import type { PrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import type { PrefabTemplate } from '@/prefab/prefab_types.js';

/** Shows a text prompt and resolves with its answer, or null when cancelled. */
export type PrefabEditorPromptShow = (options: DialogPromptFieldsOptions) => Promise<DialogPromptAnswer | null>;

/** Name and category typed for a new prefab. */
export interface PrefabEditorMakeAnswer {
  /** Prefab name; never empty. */
  readonly name: string;
  /** Prefab category; never empty. */
  readonly category: string;
}

/** Field id of a prefab name. */
const PREFAB_PROMPT_FIELD_NAME = 'name';

/** Field id of a prefab category. */
const PREFAB_PROMPT_FIELD_CATEGORY = 'category';

/** The small prompts that ask for a prefab's name and category. */
export class PrefabEditorPrompts {
  private readonly store: PrefabCatalogStore;
  private readonly promptShow: PrefabEditorPromptShow;

  /**
   * Creates the prompts.
   *
   * @param store Prefab catalog whose categories are suggested.
   * @param promptShow Shows a prompt; the modal prompt dialog when omitted.
   */
  constructor(store: PrefabCatalogStore, promptShow: PrefabEditorPromptShow = showPromptFields) {
    this.store = store;
    this.promptShow = promptShow;
  }

  /**
   * Asks for the name and category of a new prefab.
   *
   * @param categoryDefault Category the prompt starts with.
   * @returns Answer, or null when cancelled.
   */
  async makeAsk(categoryDefault: string): Promise<PrefabEditorMakeAnswer | null> {
    const answer = await this.promptShow(
      this.optionsCreate('Make Prefab', 'Make', [this.nameFieldCreate(''), this.categoryFieldCreate(categoryDefault)]),
    );
    const name = answer?.[PREFAB_PROMPT_FIELD_NAME] ?? '';
    if (answer === null || name === '') {
      return null;
    }
    return { name, category: answer[PREFAB_PROMPT_FIELD_CATEGORY] || categoryDefault };
  }

  /**
   * Asks for a new name of a prefab.
   *
   * @param template Prefab to rename.
   * @returns New name, or null when cancelled or left empty.
   */
  async renameAsk(template: PrefabTemplate): Promise<string | null> {
    const options = this.optionsCreate('Rename Prefab', 'Rename', [this.nameFieldCreate(template.name)]);
    const name = (await this.promptShow(options))?.[PREFAB_PROMPT_FIELD_NAME] ?? '';
    return name === '' ? null : name;
  }

  /**
   * Asks for a new category of a prefab.
   *
   * @param template Prefab to move.
   * @returns New category, or null when cancelled or left empty.
   */
  async categoryAsk(template: PrefabTemplate): Promise<string | null> {
    const field = { ...this.categoryFieldCreate(template.category), isRequired: true };
    const options = this.optionsCreate('Change Prefab Category', 'Move', [field]);
    const category = (await this.promptShow(options))?.[PREFAB_PROMPT_FIELD_CATEGORY] ?? '';
    return category === '' ? null : category;
  }

  /**
   * Builds prompt options shown over the document body.
   *
   * @param title Dialog title.
   * @param confirmLabel Affirmative button label.
   * @param fields Fields in display order.
   * @returns Prompt options.
   */
  private optionsCreate(
    title: string,
    confirmLabel: string,
    fields: readonly DialogPromptField[],
  ): DialogPromptFieldsOptions {
    return { host: document.body, title, confirmLabel, fields };
  }

  /**
   * Builds the required name field.
   *
   * @param value Name the field starts with.
   * @returns Field.
   */
  private nameFieldCreate(value: string): DialogPromptField {
    return {
      id: PREFAB_PROMPT_FIELD_NAME,
      label: 'Name',
      value,
      placeholder: 'Prefab name',
      isRequired: true,
      suggestions: [],
    };
  }

  /**
   * Builds the optional category field, suggesting the existing categories.
   *
   * @param value Category the field starts with.
   * @returns Field.
   */
  private categoryFieldCreate(value: string): DialogPromptField {
    return {
      id: PREFAB_PROMPT_FIELD_CATEGORY,
      label: 'Category',
      value,
      placeholder: value,
      isRequired: false,
      suggestions: this.store.categoriesRead(),
    };
  }
}
