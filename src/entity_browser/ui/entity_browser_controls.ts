import {
  createSettingsSecondaryButton,
  createSettingsSelect,
  createSettingsTextInput,
} from '@/ui/settings/settings_form_controls.js';
import {
  entityBrowserViewModeSanitize,
  type EntityBrowserSortMode,
  type EntityBrowserViewMode,
  type EntityBrowserViewOptions,
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

/** Label of the category filter choice that shows every category. */
const ENTITY_BROWSER_CATEGORY_ALL_LABEL = 'All';

/** Choices of the view dropdown. */
const ENTITY_BROWSER_VIEW_MODE_CHOICES: readonly { value: EntityBrowserViewMode; label: string }[] = [
  { value: 'icons', label: 'Icons' },
  { value: 'tiles_3d', label: '3D Tiles' },
  { value: 'single_3d', label: '1 Tile 3D' },
];

/**
 * Controls row under the tiles: view mode, sort order, Group and Used toggles
 * and a name search field.
 */
export class EntityBrowserControls {
  readonly element: HTMLElement;
  readonly viewModeSelect: HTMLSelectElement;
  readonly sortSelect: HTMLSelectElement;
  readonly categorySelect: HTMLSelectElement;
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
    this.viewModeSelect = this.viewModeSelectCreate();
    this.sortSelect = this.sortSelectCreate();
    this.categorySelect = this.categorySelectCreate();
    this.groupToggle = createSettingsSecondaryButton('Group', () => this.groupToggled());
    this.usedToggle = createSettingsSecondaryButton('Used', () => this.usedToggled());
    this.groupToggle.title = 'Show tiles under category headers';
    this.usedToggle.title = 'Show only kinds used in this map';
    this.searchInput = this.searchInputCreate();
    this.element.append(
      this.viewModeSelect,
      this.sortSelect,
      this.categorySelect,
      this.groupToggle,
      this.usedToggle,
      this.searchInput,
    );
    this.optionsShow(options);
  }

  /**
   * Replaces the category filter choices with the given top-level categories,
   * keeping "All" first and the current choice selected.
   *
   * @param categories Top-level category names in display order.
   */
  categoriesShow(categories: readonly string[]): void {
    const allOption = this.categoryOptionCreate('', ENTITY_BROWSER_CATEGORY_ALL_LABEL);
    const categoryOptions = categories.map((name) => this.categoryOptionCreate(name, name));
    this.categorySelect.replaceChildren(allOption, ...categoryOptions);
    this.categorySelect.value = this.options.categoryFilter;
  }

  /**
   * Creates one option of the category filter.
   *
   * @param value Category name, or empty for every category.
   * @param label Visible text.
   * @returns Option element.
   */
  private categoryOptionCreate(value: string, label: string): HTMLOptionElement {
    const option = this.categorySelect.ownerDocument.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }

  /**
   * Creates the category filter, listing only "All" until categories are shown.
   *
   * @returns Select element.
   */
  private categorySelectCreate(): HTMLSelectElement {
    const choices = [{ value: '', label: ENTITY_BROWSER_CATEGORY_ALL_LABEL }];
    const select = createSettingsSelect(choices, '', (value) => this.optionsChanged({ categoryFilter: value }));
    select.title = 'Show one category, such as Prefabs or Game Entities, or all of them';
    select.style.width = 'auto';
    select.style.flex = '0 0 auto';
    return select;
  }

  /**
   * Shows display choices without reporting a change.
   *
   * @param options Display choices.
   */
  optionsShow(options: EntityBrowserViewOptions): void {
    this.options = options;
    this.viewModeSelect.value = options.viewMode;
    this.sortSelect.value = options.sortMode;
    this.categorySelect.value = options.categoryFilter;
    entityBrowserStyleToggleActive(this.groupToggle, options.groupByCategory);
    entityBrowserStyleToggleActive(this.usedToggle, options.usedOnly);
    if (this.searchInput.value !== options.searchText) {
      this.searchInput.value = options.searchText;
    }
  }

  /**
   * Creates the view dropdown: icons, 3D tiles or one large 3D tile.
   *
   * @returns Select element.
   */
  private viewModeSelectCreate(): HTMLSelectElement {
    const select = createSettingsSelect(ENTITY_BROWSER_VIEW_MODE_CHOICES, this.options.viewMode, (value) =>
      this.optionsChanged({ viewMode: entityBrowserViewModeSanitize(value, this.options.viewMode) }),
    );
    select.title = 'Show icons, 3D tiles of each kind, or one large 3D tile of the selected kind';
    select.style.width = 'auto';
    select.style.flex = '0 0 auto';
    return select;
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
    const input = createSettingsTextInput(this.options.searchText, 'Search by name or category', report);
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
