import { LAYER_FLAG_NAMES, type LayerDefinition, type LayerFlagName } from '@/layer/model/layer_definition.js';
import { IconLayerToggle } from '@/layer/ui/icon_layer_toggle.js';
import { PanelLayersStyles } from '@/layer/ui/panel_layers_styles.js';

/** What one layer row shows. */
export interface PanelLayersRowState {
  /** Layer the row shows. */
  definition: LayerDefinition;
  /** True when the layer is the current layer. */
  isCurrent: boolean;
  /** True when the row is the panel's selected row. */
  isSelected: boolean;
  /** Number of top-level objects in the layer. */
  objectCount: number;
  /** Name shared by the radio buttons of one panel. */
  radioGroupName: string;
}

/** What a layer row asks its panel to do. */
export interface PanelLayersRowCallbacks {
  /** Selects the row's layer in the panel. */
  onSelect: (layerIdentifier: string) => void;
  /** Makes the row's layer the current layer. */
  onMakeCurrent: (layerIdentifier: string) => void;
  /** Flips one switch of the row's layer. */
  onFlagToggle: (layerIdentifier: string, flag: LayerFlagName) => void;
  /** Opens the context menu of the row's layer at a client position. */
  onContextMenu: (layerIdentifier: string, clientX: number, clientY: number) => void;
}

/** Tooltips of the switches of a layer row. */
const PANEL_LAYERS_TOGGLE_TOOLTIPS: Record<LayerFlagName, string> = {
  omitFromExport: 'Omit from export',
  hidden: 'Hide in the editor',
  locked: 'Lock',
};

/**
 * Formats the object count shown under a layer name.
 *
 * @param objectCount Number of objects.
 * @returns 1 object or "N objects".
 */
export function panelLayersObjectCountFormat(objectCount: number): string {
  return objectCount === 1 ? '1 object' : `${objectCount} objects`;
}

/**
 * One row of the layers panel: current layer radio, name, object count and the
 * omit from export, visibility and lock switches.
 */
export class PanelLayersRow {
  private readonly state: PanelLayersRowState;
  private readonly callbacks: PanelLayersRowCallbacks;
  private readonly rowElement: HTMLDivElement;
  private readonly textColumnElement: HTMLDivElement;
  private readonly nameElement: HTMLSpanElement;

  /**
   * Builds the row.
   *
   * @param state What the row shows.
   * @param callbacks What the row asks its panel to do.
   */
  constructor(state: PanelLayersRowState, callbacks: PanelLayersRowCallbacks) {
    this.state = state;
    this.callbacks = callbacks;
    this.rowElement = document.createElement('div');
    this.textColumnElement = document.createElement('div');
    this.nameElement = document.createElement('span');
    this.rowBuild();
    this.rowEventsBind();
  }

  /**
   * Returns the row element.
   *
   * @returns Row element.
   */
  getElement(): HTMLDivElement {
    return this.rowElement;
  }

  /**
   * Returns the column holding the name, which hosts an inline rename.
   *
   * @returns Text column element.
   */
  textColumnRead(): HTMLDivElement {
    return this.textColumnElement;
  }

  /**
   * Returns the element showing the layer name.
   *
   * @returns Name element.
   */
  nameElementRead(): HTMLSpanElement {
    return this.nameElement;
  }

  /**
   * Returns the identifier of the row's layer.
   *
   * @returns Layer identifier.
   */
  layerIdentifierRead(): string {
    return this.state.definition.id;
  }

  /** Builds the row content: radio, text column and switches. */
  private rowBuild(): void {
    this.rowElement.dataset['layerId'] = this.state.definition.id;
    PanelLayersStyles.rowApply(this.rowElement, this.state.isSelected);
    this.rowElement.appendChild(this.radioCreate());
    this.textColumnBuild();
    this.rowElement.appendChild(this.textColumnElement);
    LAYER_FLAG_NAMES.forEach((flag) => this.rowElement.appendChild(this.toggleCreate(flag)));
  }

  /**
   * Creates the radio button marking the current layer.
   *
   * @returns Radio input.
   */
  private radioCreate(): HTMLInputElement {
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = this.state.radioGroupName;
    radio.checked = this.state.isCurrent;
    radio.title = 'Current layer';
    PanelLayersStyles.radioApply(radio);
    radio.addEventListener('click', (event) => {
      event.stopPropagation();
      this.callbacks.onMakeCurrent(this.layerIdentifierRead());
    });
    return radio;
  }

  /** Fills the text column with the name and the object count. */
  private textColumnBuild(): void {
    PanelLayersStyles.textColumnApply(this.textColumnElement);
    this.nameElement.textContent = this.state.definition.name;
    this.nameElement.dataset['layerName'] = 'true';
    PanelLayersStyles.nameApply(this.nameElement, this.state.isCurrent);
    const countElement = document.createElement('span');
    countElement.textContent = panelLayersObjectCountFormat(this.state.objectCount);
    countElement.dataset['layerObjectCount'] = 'true';
    PanelLayersStyles.countApply(countElement);
    this.textColumnElement.append(this.nameElement, countElement);
  }

  /**
   * Creates the button of one layer switch.
   *
   * @param flag Switch the button flips.
   * @returns Switch button.
   */
  private toggleCreate(flag: LayerFlagName): HTMLButtonElement {
    const isFlagOn = this.state.definition[flag];
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.dataset['layerFlag'] = flag;
    toggle.dataset['layerFlagOn'] = String(isFlagOn);
    toggle.title = PANEL_LAYERS_TOGGLE_TOOLTIPS[flag];
    toggle.innerHTML = IconLayerToggle.markup(flag, isFlagOn);
    PanelLayersStyles.toggleApply(toggle, isFlagOn || flag === 'hidden');
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      this.callbacks.onFlagToggle(this.layerIdentifierRead(), flag);
    });
    return toggle;
  }

  /** Binds selection, double-click and context menu events of the row. */
  private rowEventsBind(): void {
    const layerIdentifier = this.layerIdentifierRead();
    this.rowElement.addEventListener('click', () => this.callbacks.onSelect(layerIdentifier));
    this.rowElement.addEventListener('dblclick', () => this.callbacks.onMakeCurrent(layerIdentifier));
    this.rowElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.callbacks.onSelect(layerIdentifier);
      this.callbacks.onContextMenu(layerIdentifier, event.clientX, event.clientY);
    });
  }
}
