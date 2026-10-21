import {
  createSettingsSecondaryButton,
  createSettingsSelect,
  createSettingsTextInput,
} from '@/ui/settings/settings_form_controls.js';
import type {
  EntityBrowserSortMode,
  EntityBrowserViewOptions,
} from '@/entity_browser/view/entity_browser_view_options.js';
import {
  entityBrowserStyleControlsRow,
  entityBrowserStyleToggleActive,
} from '@/entity_browser/ui/entity_browser_styles.js';

/** Choices of the sort dropdown. */
const ENTITY_BROWSER_SORT_CHOICES: readonly { value: EntityBrowserSortMode; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'category', label: 'Category' },
];

/**
 * Controls row under the tiles: sort order, Group and Used toggles and a name
 * search field.
 */
export class EntityBrowserControls {
  readonly element: HTMLElement;
  readonly sortSelect: HTMLSelectElement;
  readonly groupToggle: HTMLButtonElement;
  readonly usedToggle: HTMLButtonElement;
  readonly searchInput: HTMLInputElement;
  private readonly optionsChanged: (changes: Partial<EntityBrowserViewOptions>) => void;
  private options: EntityBrowserViewOptions;

  /**
   * Creates the controls showing the given choices.
   *
   * @param ownerDocument Document that owns the row.
   * @param options Current display choices.
   * @param optionsChanged Receives the choices the user changed.
   */
  constructor(
    ownerDocument: Document,
    options: EntityBrowserViewOptions,
    optionsChanged: (changes: Partial<EntityBrowserViewOptions>) => void,
  ) {
    this.options = options;
    this.optionsChanged = optionsChanged;
    this.element = ownerDocument.createElement('div');
    entityBrowserStyleControlsRow(this.element);
    this.sortSelect = this.sortSelectCreate();
    this.groupToggle = createSettingsSecondaryButton('Group', () => this.groupToggled());
    this.usedToggle = createSettingsSecondaryButton('Used', () => this.usedToggled());
    this.groupToggle.title = 'Show tiles under category headers';
    this.usedToggle.title = 'Show only kinds used in this map';
    this.searchInput = this.searchInputCreate();
    this.element.append(this.sortSelect, this.groupToggle, this.usedToggle, this.searchInput);
    this.optionsShow(options);
  }

  /**
   * Shows display choices without reporting a change.
   *
   * @param options Display choices.
   */
  optionsShow(options: EntityBrowserViewOptions): void {
    this.options = options;
    this.sortSelect.value = options.sortMode;
    entityBrowserStyleToggleActive(this.groupToggle, options.groupByCategory);
    entityBrowserStyleToggleActive(this.usedToggle, options.usedOnly);
    if (this.searchInput.value !== options.searchText) {
      this.searchInput.value = options.searchText;
    }
  }

  /**
   * Creates the sort dropdown.
   *
   * @returns Select element.
   */
  private sortSelectCreate(): HTMLSelectElement {
    const select = createSettingsSelect(ENTITY_BROWSER_SORT_CHOICES, this.options.sortMode, (value) =>
      this.optionsChanged({ sortMode: value === 'name' ? 'name' : 'category' }),
    );
    select.title = 'Sort tiles by name or by category';
    select.style.width = 'auto';
    select.style.flex = '0 0 auto';
    return select;
  }

  /**
   * Creates the search field, reporting every keystroke.
   *
   * @returns Input element.
   */
  private searchInputCreate(): HTMLInputElement {
    const report = (value: string): void => this.optionsChanged({ searchText: value });
    const input = createSettingsTextInput(this.options.searchText, 'Search entities', report);
    input.placeholder = 'Search';
    input.style.flex = '1 1 60px';
    input.style.minWidth = '40px';
    input.addEventListener('input', () => report(input.value));
    return input;
  }

  /** Flips the Group toggle. */
  private groupToggled(): void {
    this.optionsChanged({ groupByCategory: !this.options.groupByCategory });
  }

  /** Flips the Used toggle. */
  private usedToggled(): void {
    this.optionsChanged({ usedOnly: !this.options.usedOnly });
  }
}
