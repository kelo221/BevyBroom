import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { getStateEntityPlace } from '@/tools/entity_place/state_entity_place.js';
import { getStateBlockDrawSettings } from '@/tools/block/state_block_draw_settings.js';
import { applyViewportToolOptionsTextButtonMetrics } from './viewport_tool_options_control_style.js';
import { styleViewportToolRailButton } from '@/tools/chrome/rail/viewport_tool_rail_button.js';

/**
 * Provides the Entity tool class selector and the Object Select empty-space
 * brush draw toggle for `ViewportToolOptionsBar`.
 */
export class ViewportToolEntityPlaceControls {
  private readonly entityContainer: HTMLElement;
  private readonly entitySelect: HTMLSelectElement;
  private readonly emptyDrawButton: HTMLButtonElement;
  private readonly unsubscribeEntity: () => void;
  private readonly unsubscribeBlock: () => void;

  /**
   * Creates the Entity tool and empty-space draw option bar controls.
   *
   * @param ownerDocument Document used to construct DOM nodes.
   */
  constructor(ownerDocument: Document) {
    this.entityContainer = ownerDocument.createElement('div');
    this.entitySelect = ownerDocument.createElement('select');
    this.emptyDrawButton = ownerDocument.createElement('button');
    this.styleEntityContainer(ownerDocument);
    this.styleEmptyDrawButton();
    this.unsubscribeEntity = getStateEntityPlace().changeListenerAdd(() => {
      this.syncEntitySelect();
    });
    this.unsubscribeBlock = getStateBlockDrawSettings().changeListenerAdd(() => {
      this.syncEmptyDrawButton();
    });
    this.syncEntitySelect();
    this.syncEmptyDrawButton();
  }

  /**
   * Returns the Entity tool class selector container element.
   *
   * @returns Entity selector element.
   */
  entityElementRead(): HTMLElement {
    return this.entityContainer;
  }

  /**
   * Returns the Object Select empty-space brush draw toggle button.
   *
   * @returns Empty-draw toggle button.
   */
  emptyDrawButtonRead(): HTMLButtonElement {
    return this.emptyDrawButton;
  }

  /** Removes state listeners and DOM nodes. */
  dispose(): void {
    this.unsubscribeEntity();
    this.unsubscribeBlock();
    this.entityContainer.remove();
    this.emptyDrawButton.remove();
  }

  /**
   * Builds and styles the Entity class dropdown container.
   *
   * @param ownerDocument Document used to create the label.
   */
  private styleEntityContainer(ownerDocument: Document): void {
    this.entityContainer.className = 'viewport-tool-entity-place-controls';
    this.entityContainer.style.display = 'inline-flex';
    this.entityContainer.style.alignItems = 'center';
    this.entityContainer.style.gap = '6px';
    const label = ownerDocument.createElement('span');
    label.textContent = 'Entity:';
    label.style.fontSize = '11px';
    label.style.color = Theme.statusBarTextColor;
    this.styleSelectElement();
    this.entityContainer.appendChild(label);
    this.entityContainer.appendChild(this.entitySelect);
    this.entityContainer.appendChild(this.browseButtonCreate(ownerDocument));
  }

  /**
   * Creates the Browse button that opens the floating entity browser.
   *
   * @param ownerDocument Document used to create the button.
   * @returns Browse button.
   */
  private browseButtonCreate(ownerDocument: Document): HTMLButtonElement {
    const button = ownerDocument.createElement('button');
    button.type = 'button';
    button.className = 'viewport-tool-entity-place-browse';
    button.textContent = 'Browse…';
    button.title = 'Open the entity browser';
    applyViewportToolOptionsTextButtonMetrics(button);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      getStateEntityPlace().browseRequest();
    });
    return button;
  }

  /** Styles the select element and binds change events. */
  private styleSelectElement(): void {
    this.entitySelect.className = 'viewport-tool-entity-place-select';
    this.entitySelect.style.background = Theme.inputBackgroundColor;
    this.entitySelect.style.color = Theme.buttonTextColor;
    this.entitySelect.style.border = `1px solid ${hexToRgb(Theme.separatorColor)}`;
    this.entitySelect.style.borderRadius = '4px';
    this.entitySelect.style.fontSize = '11px';
    this.entitySelect.style.padding = '2px 6px';
    this.entitySelect.addEventListener('change', () => {
      getStateEntityPlace().activeEntryIdWrite(this.entitySelect.value);
    });
  }

  /** Styles and binds the Object Select empty-space draw toggle button. */
  private styleEmptyDrawButton(): void {
    this.emptyDrawButton.type = 'button';
    this.emptyDrawButton.className = 'viewport-tool-empty-draw-toggle';
    this.emptyDrawButton.textContent = 'Drag Draw';
    this.emptyDrawButton.title = 'Toggle empty-space drag brush creation in Select mode';
    applyViewportToolOptionsTextButtonMetrics(this.emptyDrawButton);
    this.emptyDrawButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const state = getStateBlockDrawSettings();
      state.emptySpaceDrawInSelectWrite(!state.emptySpaceDrawInSelectRead());
    });
  }

  /** Refreshes the Entity class options from `StateEntityPlace`. */
  private syncEntitySelect(): void {
    const state = getStateEntityPlace();
    const entries = state.entriesRead();
    const active = state.activeEntryRead();
    this.entitySelect.replaceChildren();
    for (const entry of entries) {
      const opt = this.entitySelect.ownerDocument.createElement('option');
      opt.value = entry.id;
      opt.textContent = `${entry.category}: ${entry.label}`;
      opt.selected = active?.id === entry.id;
      this.entitySelect.appendChild(opt);
    }
  }

  /** Updates the active highlight of the Drag Draw button. */
  private syncEmptyDrawButton(): void {
    const enabled = getStateBlockDrawSettings().emptySpaceDrawInSelectRead();
    styleViewportToolRailButton(this.emptyDrawButton, enabled);
  }
}
