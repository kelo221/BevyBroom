import { PanelLayersStyles } from '@/layer/ui/panel_layers_styles.js';

/** Names of the bottom bar buttons of the layers panel. */
export type PanelLayersToolbarButtonName = 'add' | 'remove' | 'moveUp' | 'moveDown';

/** What the bottom bar asks its panel to do. */
export type PanelLayersToolbarCallbacks = Record<PanelLayersToolbarButtonName, () => void>;

/** Which bottom bar buttons can be used. */
export type PanelLayersToolbarState = Record<PanelLayersToolbarButtonName, boolean>;

/** Label and tooltip of one bottom bar button. */
interface PanelLayersToolbarButtonSpec {
  name: PanelLayersToolbarButtonName;
  label: string;
  tooltip: string;
}

/** Bottom bar buttons in display order. */
const PANEL_LAYERS_TOOLBAR_BUTTONS: readonly PanelLayersToolbarButtonSpec[] = [
  { name: 'add', label: '+', tooltip: 'Add layer' },
  { name: 'remove', label: '\u2212', tooltip: 'Remove layer' },
  { name: 'moveUp', label: '\u25B2', tooltip: 'Move layer up' },
  { name: 'moveDown', label: '\u25BC', tooltip: 'Move layer down' },
];

/** Bottom bar of the layers panel with add, remove and move buttons. */
export class PanelLayersToolbar {
  private readonly barElement: HTMLDivElement;
  private readonly buttons: Map<PanelLayersToolbarButtonName, HTMLButtonElement>;
  private readonly callbacks: PanelLayersToolbarCallbacks;

  /**
   * Builds the bar.
   *
   * @param callbacks Button actions.
   */
  constructor(callbacks: PanelLayersToolbarCallbacks) {
    this.callbacks = callbacks;
    this.barElement = document.createElement('div');
    this.buttons = new Map();
    PanelLayersStyles.toolbarApply(this.barElement);
    PANEL_LAYERS_TOOLBAR_BUTTONS.forEach((spec) => this.buttonCreate(spec));
  }

  /**
   * Returns the bar element.
   *
   * @returns Bar element.
   */
  getElement(): HTMLDivElement {
    return this.barElement;
  }

  /**
   * Enables or disables each button.
   *
   * @param state Whether each button can be used.
   */
  stateApply(state: PanelLayersToolbarState): void {
    this.buttons.forEach((button, name) => {
      button.disabled = !state[name];
      PanelLayersStyles.toolbarButtonApply(button, state[name]);
    });
  }

  /**
   * Creates one button and adds it to the bar.
   *
   * @param spec Button label, tooltip and name.
   */
  private buttonCreate(spec: PanelLayersToolbarButtonSpec): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = spec.label;
    button.title = spec.tooltip;
    button.dataset['layerAction'] = spec.name;
    PanelLayersStyles.toolbarButtonApply(button, true);
    button.addEventListener('click', () => this.callbacks[spec.name]());
    this.buttons.set(spec.name, button);
    this.barElement.appendChild(button);
  }
}
