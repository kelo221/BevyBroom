import * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { LayerMoveDirection } from '@/layer/commands/command_layer_move.js';
import { LAYER_DEFAULT_ID, type LayerFlagName } from '@/layer/model/layer_definition.js';
import type { LayerManager } from '@/layer/model/layer_manager.js';
import { LayerOperations } from '@/layer/operations/layer_operations.js';
import { LayerSelectionOperations } from '@/layer/operations/layer_selection_operations.js';
import { PanelLayersContextMenu } from '@/layer/ui/panel_layers_context_menu.js';
import { PanelLayersRenameSession } from '@/layer/ui/panel_layers_rename_session.js';
import { PanelLayersRow, type PanelLayersRowCallbacks } from '@/layer/ui/panel_layers_row.js';
import { PanelLayersStyles } from '@/layer/ui/panel_layers_styles.js';
import { PanelLayersToolbar, type PanelLayersToolbarState } from '@/layer/ui/panel_layers_toolbar.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';

/** Editor systems the layers panel works with. */
export interface PanelLayersDependencies {
  /** Layers of the edited world. */
  layerManager: LayerManager;
  /** Undo stack layer edits go onto. */
  commandStack: CommandStack;
  /** Object selection. */
  selectionManager: ManagerSelection;
  /** World root the layer manager owns. */
  worldGroup: THREE.Object3D;
  /** Editor refresh called after every layer edit. */
  refresh: () => void;
}

/**
 * Self-contained layers panel: one row per layer with the current layer radio,
 * name, object count and switches, a bottom bar to add, remove and reorder
 * layers, and a context menu per row. It fills its host as a flex column.
 */
export class PanelLayers {
  private readonly hostElement: HTMLElement;
  private readonly layerManager: LayerManager;
  private readonly operations: LayerOperations;
  private readonly selectionOperations: LayerSelectionOperations;
  private readonly rootElement: HTMLDivElement;
  private readonly listElement: HTMLDivElement;
  private readonly toolbar: PanelLayersToolbar;
  private readonly contextMenu: PanelLayersContextMenu;
  private readonly renameSession: PanelLayersRenameSession;
  private readonly changeListener: () => void;
  private readonly radioGroupName: string;
  private rows: PanelLayersRow[];
  private selectedLayerIdentifier: string;
  private isRenderScheduled: boolean;
  private isDisposed: boolean;

  /**
   * Builds the panel inside a host element and starts following layer changes.
   *
   * @param hostElement Element the panel fills.
   * @param dependencies Editor systems the panel works with.
   */
  constructor(hostElement: HTMLElement, dependencies: PanelLayersDependencies) {
    PanelLayers.dependenciesValidate(dependencies);
    this.hostElement = hostElement;
    this.layerManager = dependencies.layerManager;
    this.operations = new LayerOperations(dependencies.layerManager, dependencies.commandStack, dependencies.refresh);
    this.selectionOperations = new LayerSelectionOperations(this.operations, dependencies.selectionManager);
    this.rootElement = document.createElement('div');
    this.listElement = document.createElement('div');
    this.toolbar = this.toolbarCreate();
    this.contextMenu = this.contextMenuCreate();
    this.renameSession = new PanelLayersRenameSession(() => this.render());
    this.changeListener = () => this.renderSchedule();
    this.radioGroupName = `layers_current_${THREE.MathUtils.generateUUID()}`;
    this.rows = [];
    this.selectedLayerIdentifier = this.layerManager.currentLayerIdRead();
    this.isRenderScheduled = false;
    this.isDisposed = false;
    this.mount();
  }

  /**
   * Returns the panel root element.
   *
   * @returns Root element.
   */
  getElement(): HTMLElement {
    return this.rootElement;
  }

  /**
   * Returns the layer selected in the panel.
   *
   * @returns Selected layer identifier.
   */
  selectedLayerIdRead(): string {
    return this.selectedLayerIdentifier;
  }

  /**
   * Returns the input of the rename in progress.
   *
   * @returns Input element, or null when no rename is in progress.
   */
  renameInputRead(): HTMLInputElement | null {
    return this.renameSession.inputElementRead();
  }

  /** Rebuilds every row and the bottom bar state now. */
  render(): void {
    if (this.isDisposed) {
      return;
    }
    this.isRenderScheduled = false;
    this.selectedLayerEnsureExists();
    this.rows = this.layerManager.layersList().map((definition) => this.rowCreate(definition.id));
    this.listElement.replaceChildren(...this.rows.map((row) => row.getElement()));
    this.toolbar.stateApply(this.toolbarStateRead());
  }

  /**
   * Adds a layer, selects it and starts renaming it.
   *
   * @returns Identifier of the new layer.
   */
  layerAdd(): string {
    const definition = this.operations.layerCreate();
    this.selectedLayerIdentifier = definition.id;
    this.render();
    this.renameBegin(definition.id);
    return definition.id;
  }

  /**
   * Starts renaming a layer other than the default in its row.
   *
   * @param layerIdentifier Layer to rename.
   */
  renameBegin(layerIdentifier: string): void {
    const row = this.rows.find((candidate) => candidate.layerIdentifierRead() === layerIdentifier);
    const definition = this.layerManager.layerFind(layerIdentifier);
    if (row === undefined || definition === null || layerIdentifier === LAYER_DEFAULT_ID) {
      return;
    }
    this.renameSession.begin(row, definition.name, (name) => this.operations.layerRename(layerIdentifier, name));
  }

  /** Stops following layer changes and removes the panel from its host. */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.layerManager.changeListenerRemove(this.changeListener);
    this.renameSession.dispose();
    this.contextMenu.dispose();
    this.rootElement.remove();
  }

  /**
   * Throws when the layer manager does not own the given world root.
   *
   * @param dependencies Panel dependencies.
   */
  private static dependenciesValidate(dependencies: PanelLayersDependencies): void {
    if (dependencies.layerManager.worldGroupRead() !== dependencies.worldGroup) {
      throw new Error('The layers panel needs the layer manager of its world group');
    }
  }

  /** Builds the panel DOM, adds it to the host and renders the rows. */
  private mount(): void {
    PanelLayersStyles.rootApply(this.rootElement);
    PanelLayersStyles.listApply(this.listElement);
    this.rootElement.dataset['panel'] = 'layers';
    this.rootElement.append(this.listElement, this.toolbar.getElement());
    this.hostElement.appendChild(this.rootElement);
    this.layerManager.changeListenerAdd(this.changeListener);
    this.render();
  }

  /** Renders once after the current task unless a rename is in progress. */
  private renderSchedule(): void {
    if (this.isRenderScheduled || this.isDisposed) {
      return;
    }
    this.isRenderScheduled = true;
    queueMicrotask(() => {
      if (this.renameSession.activeIs()) {
        this.isRenderScheduled = false;
        return;
      }
      this.render();
    });
  }

  /** Falls back to the current layer when the selected layer no longer exists. */
  private selectedLayerEnsureExists(): void {
    if (this.layerManager.layerFind(this.selectedLayerIdentifier) === null) {
      this.selectedLayerIdentifier = this.layerManager.currentLayerIdRead();
    }
  }

  /**
   * Creates the row of one layer.
   *
   * @param layerIdentifier Layer identifier.
   * @returns New row.
   */
  private rowCreate(layerIdentifier: string): PanelLayersRow {
    const definition = this.layerManager.layerFind(layerIdentifier) ?? this.layerManager.layerDefaultRead();
    const state = {
      definition,
      isCurrent: this.layerManager.currentLayerIdRead() === layerIdentifier,
      isSelected: this.selectedLayerIdentifier === layerIdentifier,
      objectCount: this.layerManager.objectCountRead(layerIdentifier),
      radioGroupName: this.radioGroupName,
    };
    return new PanelLayersRow(state, this.rowCallbacksCreate());
  }

  /**
   * Creates what rows ask the panel to do.
   *
   * @returns Row callbacks.
   */
  private rowCallbacksCreate(): PanelLayersRowCallbacks {
    return {
      onSelect: (layerIdentifier) => this.layerSelect(layerIdentifier),
      onMakeCurrent: (layerIdentifier) => this.operations.currentLayerSet(layerIdentifier),
      onFlagToggle: (layerIdentifier: string, flag: LayerFlagName) =>
        this.operations.layerFlagToggle(layerIdentifier, flag),
      onContextMenu: (layerIdentifier, clientX, clientY) =>
        this.contextMenu.open(this.rootElement, layerIdentifier, clientX, clientY),
    };
  }

  /**
   * Selects a layer in the panel.
   *
   * @param layerIdentifier Layer to select.
   */
  private layerSelect(layerIdentifier: string): void {
    if (this.selectedLayerIdentifier !== layerIdentifier) {
      this.selectedLayerIdentifier = layerIdentifier;
      this.render();
    }
  }

  /**
   * Moves the selected layer one step.
   *
   * @param direction -1 for up, 1 for down.
   */
  private selectedLayerMove(direction: LayerMoveDirection): void {
    this.operations.layerMove(this.selectedLayerIdentifier, direction);
    this.render();
  }

  /**
   * Returns which bottom bar buttons can be used for the selected layer.
   *
   * @returns Button states.
   */
  private toolbarStateRead(): PanelLayersToolbarState {
    const index = this.layerManager.layerIndexOf(this.selectedLayerIdentifier);
    const lastIndex = this.layerManager.layersList().length - 1;
    return { add: true, remove: index > 0, moveUp: index > 1, moveDown: index > 0 && index < lastIndex };
  }

  /**
   * Creates the bottom bar.
   *
   * @returns Bottom bar.
   */
  private toolbarCreate(): PanelLayersToolbar {
    return new PanelLayersToolbar({
      add: () => this.layerAdd(),
      remove: () => this.operations.layerRemove(this.selectedLayerIdentifier),
      moveUp: () => this.selectedLayerMove(-1),
      moveDown: () => this.selectedLayerMove(1),
    });
  }

  /**
   * Creates the row context menu.
   *
   * @returns Context menu.
   */
  private contextMenuCreate(): PanelLayersContextMenu {
    return new PanelLayersContextMenu({
      makeCurrent: (layerIdentifier) => this.operations.currentLayerSet(layerIdentifier),
      selectionMoveHere: (layerIdentifier) => this.selectionOperations.selectionMoveToLayer(layerIdentifier),
      selectAll: (layerIdentifier) => this.selectionOperations.layerObjectsSelect(layerIdentifier),
      isolate: (layerIdentifier) => this.operations.layerIsolate(layerIdentifier),
      showAll: () => this.operations.layersShowAll(),
      rename: (layerIdentifier) => this.renameBegin(layerIdentifier),
      remove: (layerIdentifier) => this.operations.layerRemove(layerIdentifier),
      selectionAnyIs: () => this.selectionOperations.selectionAnyIs(),
      layerSelectableIs: (layerIdentifier) => this.selectionOperations.layerSelectableIs(layerIdentifier),
    });
  }
}
