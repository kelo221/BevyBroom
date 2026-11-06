import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { IconHammerCatalog } from '@/ui/icons/hammer/icon_hammer_catalog.js';
import { EditorToolId } from '@/types/editor_tool_id.js';
import { TransformMode, isBoundsWidgetMode } from '@/types/transform_mode.js';
import { EditorInteractionMode, getEditorInteractionModeLabel } from '@/types/editor_interaction_mode.js';
import { EditorComponentMode, getEditorComponentModeLabel } from '@/types/editor_component_mode.js';
import { UiStackLayers } from '@/ui/stack/ui_stack_layers.js';
import { formatToolInstructionTooltip, type ToolInstruction } from '@/tools/chrome/instruction/tool_instruction.js';
import {
  TOOL_INSTRUCTION_CAMERA_ALIGN_TO_FACE,
  TOOL_INSTRUCTION_CAMERA_RESET,
  TOOL_INSTRUCTION_CLIP_COMMIT,
  TOOL_INSTRUCTION_CLIP_FLIP,
  TOOL_INSTRUCTION_CLIP_SPLIT,
  TOOL_INSTRUCTION_COMPONENT_EDGE,
  TOOL_INSTRUCTION_COMPONENT_FACE,
  TOOL_INSTRUCTION_COMPONENT_VERTEX,
  TOOL_INSTRUCTION_EXTRUDE,
  TOOL_INSTRUCTION_GRID_ALIGN_TO_FACE,
  TOOL_INSTRUCTION_GRID_ALIGN_X,
  TOOL_INSTRUCTION_GRID_ALIGN_Y,
  TOOL_INSTRUCTION_GRID_ALIGN_Z,
  TOOL_INSTRUCTION_GRID_ORIGIN_VERTEX,
  TOOL_INSTRUCTION_GRID_RESET,
  TOOL_INSTRUCTION_FACE_INSPECTOR,
  toolInstructionForTransformMode,
} from '@/tools/chrome/instruction/tool_instruction_catalog.js';
import type { EditorOrientationAxisId } from '@/navigation/orientation/editor_orientation_axis.js';
import type { GridAlignPickMode } from '@/tools/grid/grid_align_pick_mode.js';
import {
  createViewportToolRailButton,
  styleViewportToolRailButton,
} from '@/tools/chrome/rail/viewport_tool_rail_button.js';
import {
  applyViewportToolOptionsIconButtonMetrics,
  applyViewportToolOptionsTextButtonMetrics,
} from './viewport_tool_options_control_style.js';
import { ViewportToolModeDropdown } from './viewport_tool_mode_dropdown.js';
import { ViewportToolObjectDropdown } from './viewport_tool_object_dropdown.js';
import { ViewportToolNamedDropdown } from './viewport_tool_named_dropdown.js';
import { ViewportToolShapeControls } from './viewport_tool_shape_controls.js';
import { ViewportToolEntityPlaceControls } from './viewport_tool_entity_place_controls.js';
import { ViewportToolPolygonSprinkleControls } from './viewport_tool_polygon_sprinkle_controls.js';
import type { ObjectApplyTransformKind } from '@/types/object_apply_transform_kind.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import {
  TOOLBAR_OVERFLOW_PRIORITY_TOOL_OPTIONS,
  toolbarOverflowItemMark,
  type ToolbarOverflowEntriesProvider,
} from '@/ui/toolbar/overflow/toolbar_overflow_item.js';
import { buildViewportToolModeMenuEntries } from './viewport_tool_mode_menu.js';
import { buildViewportToolObjectMenuEntries } from './viewport_tool_object_menu.js';
import type { TopologyVertexMergeMode } from '@/edit/topology/topology_vertex_merge_mode.js';
import {
  buildViewportToolEdgeMenuEntries,
  buildViewportToolFaceMenuEntries,
  buildViewportToolMeshMenuEntries,
  buildViewportToolVertexMenuEntries,
  type ViewportToolEditMenuActions,
} from './viewport_tool_edit_menu.js';

/** Callbacks for tool options actions. */
export interface ViewportToolOptionsBarHandlers {
  onTransformMode: (mode: TransformMode) => void;
  onFlipClipPlane: () => void;
  onCommitClip: () => void;
  onCommitSplit: () => void;
  faceInspectorReveal: () => void;
  onExtrudeFaces: () => void;
  onGridReset: () => void;
  onGridAlignToFace: () => void;
  onGridAlignAxis: (axis: EditorOrientationAxisId) => void;
  onGridOriginVertex: () => void;
  onCameraReset: () => void;
  onCameraAlignToFace: () => void;
  onInteractionMode: (mode: EditorInteractionMode) => void;
  onComponentMode: (mode: EditorComponentMode) => void;
  onApplyObjectTransform?: (kind: ObjectApplyTransformKind) => void;
  onConvexHull?: () => void;
  onShapeSettingChanged?: () => void;
  onEditKnife?: () => void;
  onEditLoopCut?: () => void;
  onEditMerge?: (mode: TopologyVertexMergeMode) => void;
  onEditDissolve?: () => void;
  onEditDelete?: () => void;
}

/**
 * Horizontal context bar with the options of the active tool. Floats under the
 * corner label of a pane while that pane owns hover, or sits inline in a
 * toolbar row when docked; each shown control is marked as a collapsible
 * toolbar item.
 */
export class ViewportToolOptionsBar {
  private readonly root: HTMLElement;
  private readonly actionsRow: HTMLElement;
  private readonly transformButtons: Map<TransformMode, HTMLButtonElement>;
  private readonly modeDropdown: ViewportToolModeDropdown;
  private readonly objectDropdown: ViewportToolObjectDropdown;
  private readonly shapeControls: ViewportToolShapeControls;
  private readonly entityPlaceControls: ViewportToolEntityPlaceControls;
  private readonly polygonSprinkleControls: ViewportToolPolygonSprinkleControls;
  private readonly meshDropdown: ViewportToolNamedDropdown;
  private readonly vertexMenuDropdown: ViewportToolNamedDropdown;
  private readonly edgeMenuDropdown: ViewportToolNamedDropdown;
  private readonly faceMenuDropdown: ViewportToolNamedDropdown;
  private handlers: ViewportToolOptionsBarHandlers;
  private flipButton: HTMLButtonElement;
  private clipButton: HTMLButtonElement;
  private splitButton: HTMLButtonElement;
  private faceInspectorButton: HTMLButtonElement;
  private extrudeButton: HTMLButtonElement;
  private gridResetButton: HTMLButtonElement;
  private gridAlignToFaceButton: HTMLButtonElement;
  private gridAlignXButton: HTMLButtonElement;
  private gridAlignYButton: HTMLButtonElement;
  private gridAlignZButton: HTMLButtonElement;
  private gridOriginVertexButton: HTMLButtonElement;
  private cameraResetButton: HTMLButtonElement;
  private cameraAlignToFaceButton: HTMLButtonElement;
  private activeTransformMode: TransformMode;
  private activeInteractionMode: EditorInteractionMode;
  private activeComponentMode: EditorComponentMode;
  private activeToolId: EditorToolId;
  private activeGridPickMode: GridAlignPickMode;
  private readonly componentButtons: Map<EditorComponentMode, HTMLButtonElement>;
  private readonly overflowProviders: Map<HTMLElement, ToolbarOverflowEntriesProvider>;

  /**
   * Creates the options bar under the pane title toolbar.
   *
   * @param parentElement Pane host element.
   * @param handlers Action callbacks.
   */
  constructor(parentElement: HTMLElement, handlers: ViewportToolOptionsBarHandlers) {
    this.root = parentElement.ownerDocument.createElement('div');
    this.actionsRow = parentElement.ownerDocument.createElement('div');
    this.transformButtons = new Map();
    this.componentButtons = new Map();
    this.overflowProviders = new Map();
    this.handlers = handlers;
    this.activeTransformMode = TransformMode.BOUNDS;
    this.activeInteractionMode = EditorInteractionMode.OBJECT_MODE;
    this.activeComponentMode = EditorComponentMode.VERTEX;
    this.activeToolId = EditorToolId.OBJECT;
    this.activeGridPickMode = 'none';
    this.modeDropdown = new ViewportToolModeDropdown(this.actionsRow, (mode) => {
      this.handlers.onInteractionMode(mode);
    });
    this.objectDropdown = new ViewportToolObjectDropdown(
      parentElement,
      (kind) => {
        this.handlers.onApplyObjectTransform?.(kind);
      },
      () => {
        this.handlers.onConvexHull?.();
      },
    );
    this.meshDropdown = this.createEditMenuDropdown(parentElement, 'Mesh', buildViewportToolMeshMenuEntries);
    this.vertexMenuDropdown = this.createEditMenuDropdown(parentElement, 'Vertex', buildViewportToolVertexMenuEntries);
    this.edgeMenuDropdown = this.createEditMenuDropdown(parentElement, 'Edge', buildViewportToolEdgeMenuEntries);
    this.faceMenuDropdown = this.createEditMenuDropdown(parentElement, 'Face', buildViewportToolFaceMenuEntries);
    this.shapeControls = new ViewportToolShapeControls(parentElement, () => {
      this.handlers.onShapeSettingChanged?.();
    });
    this.entityPlaceControls = new ViewportToolEntityPlaceControls(parentElement.ownerDocument);
    this.polygonSprinkleControls = new ViewportToolPolygonSprinkleControls(parentElement.ownerDocument);
    this.flipButton = this.createTextAction('Flip', TOOL_INSTRUCTION_CLIP_FLIP, () => {
      this.handlers.onFlipClipPlane();
    });
    this.clipButton = this.createTextAction('Clip', TOOL_INSTRUCTION_CLIP_COMMIT, () => {
      this.handlers.onCommitClip();
    });
    this.splitButton = this.createTextAction('Split', TOOL_INSTRUCTION_CLIP_SPLIT, () => {
      this.handlers.onCommitSplit();
    });
    this.faceInspectorButton = this.createTextAction('Textures', TOOL_INSTRUCTION_FACE_INSPECTOR, () => {
      this.handlers.faceInspectorReveal();
    });
    this.extrudeButton = this.createTextAction('Extrude', TOOL_INSTRUCTION_EXTRUDE, () => {
      this.handlers.onExtrudeFaces();
    });
    this.gridResetButton = this.createTextAction('Reset Grid', TOOL_INSTRUCTION_GRID_RESET, () => {
      this.handlers.onGridReset();
    });
    this.gridAlignToFaceButton = this.createTextAction('Grid Face', TOOL_INSTRUCTION_GRID_ALIGN_TO_FACE, () => {
      this.handlers.onGridAlignToFace();
    });
    this.gridAlignXButton = this.createTextAction('Align X', TOOL_INSTRUCTION_GRID_ALIGN_X, () => {
      this.handlers.onGridAlignAxis('x');
    });
    this.gridAlignYButton = this.createTextAction('Align Y', TOOL_INSTRUCTION_GRID_ALIGN_Y, () => {
      this.handlers.onGridAlignAxis('y');
    });
    this.gridAlignZButton = this.createTextAction('Align Z', TOOL_INSTRUCTION_GRID_ALIGN_Z, () => {
      this.handlers.onGridAlignAxis('z');
    });
    this.gridOriginVertexButton = this.createTextAction('Zero Origin', TOOL_INSTRUCTION_GRID_ORIGIN_VERTEX, () => {
      this.handlers.onGridOriginVertex();
    });
    this.cameraResetButton = this.createTextAction('Reset Cam', TOOL_INSTRUCTION_CAMERA_RESET, () => {
      this.handlers.onCameraReset();
    });
    this.cameraAlignToFaceButton = this.createTextAction('Cam Face', TOOL_INSTRUCTION_CAMERA_ALIGN_TO_FACE, () => {
      this.handlers.onCameraAlignToFace();
    });
    this.overflowProvidersDropdownsRegister();
    this.styleRoot();
    this.styleActionsRow();
    this.buildTransformButtons();
    this.buildComponentButtons();
    this.root.appendChild(this.actionsRow);
    parentElement.appendChild(this.root);
    this.setActiveTool(EditorToolId.OBJECT);
    this.setActiveTransformMode(TransformMode.BOUNDS);
    this.setActiveInteractionMode(EditorInteractionMode.OBJECT_MODE);
    this.setActiveComponentMode(EditorComponentMode.VERTEX);
    this.setClipActionsEnabled(false);
    this.setVisible(false);
  }

  /**
   * Replaces options action handlers.
   *
   * @param handlers New handlers.
   */
  setHandlers(handlers: ViewportToolOptionsBarHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Highlights the active Edit Mode component mode.
   *
   * @param mode Component mode.
   */
  setActiveComponentMode(mode: EditorComponentMode): void {
    this.activeComponentMode = mode;
    this.componentButtons.forEach((button, buttonMode) => {
      styleViewportToolRailButton(button, buttonMode === mode);
    });
  }

  /**
   * Swaps visible context actions for the active tool.
   *
   * @param toolId Active tool.
   */
  setActiveTool(toolId: EditorToolId): void {
    this.activeToolId = toolId;
    this.rebuildActionsForTool(toolId);
    this.applyActiveGridPickModeStyles();
  }

  /**
   * Highlights the armed single-use grid/camera pick action (orange) while
   * active; clears when mode is none.
   *
   * @param mode Armed pick mode from the grid orientation handler.
   */
  setActiveGridPickMode(mode: GridAlignPickMode): void {
    this.activeGridPickMode = mode;
    this.applyActiveGridPickModeStyles();
  }

  /**
   * Highlights the active transform mode among object controls.
   *
   * @param mode Transform mode.
   */
  setActiveTransformMode(mode: TransformMode): void {
    this.activeTransformMode = mode;
    this.transformButtons.forEach((button, buttonMode) => {
      styleViewportToolRailButton(button, buttonMode === mode);
    });
  }

  /**
   * Updates the Object Mode / Edit Mode dropdown and context actions.
   *
   * @param mode Interaction mode.
   */
  setActiveInteractionMode(mode: EditorInteractionMode): void {
    this.activeInteractionMode = mode;
    this.modeDropdown.setActiveMode(mode);
    this.rebuildActionsForTool(this.activeToolId);
  }

  /**
   * Enables or disables clip action buttons.
   *
   * @param enabled Whether Flip/Clip/Split may run.
   */
  setClipActionsEnabled(enabled: boolean): void {
    this.flipButton.disabled = !enabled;
    this.clipButton.disabled = !enabled;
    this.splitButton.disabled = !enabled;
    const opacity = enabled ? '1' : '0.45';
    this.flipButton.style.opacity = opacity;
    this.clipButton.style.opacity = opacity;
    this.splitButton.style.opacity = opacity;
  }

  /**
   * Shows or hides the options bar (hover-owned pane only).
   *
   * @param visible True when this pane owns hover.
   */
  setVisible(visible: boolean): void {
    this.root.style.display = visible ? 'flex' : 'none';
  }

  /**
   * Returns the options bar root element.
   *
   * @returns Root element.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /** Removes the options bar from the DOM. */
  dispose(): void {
    this.modeDropdown.dispose();
    this.objectDropdown.dispose();
    this.shapeControls.dispose();
    this.entityPlaceControls.dispose();
    this.polygonSprinkleControls.dispose();
    this.meshDropdown.dispose();
    this.vertexMenuDropdown.dispose();
    this.edgeMenuDropdown.dispose();
    this.faceMenuDropdown.dispose();
    this.root.remove();
    this.transformButtons.clear();
  }

  /**
   * Lays out a content-sized floating strip under the viewport corner label
   * (same language as the tool rail: only as wide as its controls).
   */
  private styleRoot(): void {
    this.root.classList.add('editor-viewport-tool-options-bar');
    this.applyFloatingOptionsBarPosition();
    this.applyFloatingOptionsBarChrome();
  }

  /** Positions the options bar under the corner label at the content inset. */
  private applyFloatingOptionsBarPosition(): void {
    this.root.style.position = 'absolute';
    this.root.style.left = `${Theme.viewportToolFloatingOffsetLeftPx}px`;
    this.root.style.top = `${Theme.viewportLabelHeightPx + Theme.viewportToolFloatingOffsetTopPx}px`;
    this.root.style.right = 'auto';
    this.root.style.width = 'max-content';
    this.root.style.maxWidth = 'calc(100% - 20px)';
    this.root.style.height = 'auto';
  }

  /** Applies floating-panel chrome matching the tool rail. */
  private applyFloatingOptionsBarChrome(): void {
    this.root.style.display = 'none';
    this.root.style.alignItems = 'center';
    this.root.style.gap = '6px';
    this.root.style.padding = '4px 6px';
    this.root.style.boxSizing = 'border-box';
    this.root.style.background = hexToRgb(Theme.propertiesPanelBackground);
    this.root.style.border = `1px solid ${hexToRgb(Theme.separatorColor)}`;
    this.root.style.borderRadius = '8px';
    this.root.style.boxShadow = Theme.windowShadow;
    this.root.style.zIndex = String(UiStackLayers.viewportChrome + 1);
    this.root.style.pointerEvents = 'auto';
  }

  /** Styles the left-aligned actions cluster. */
  private styleActionsRow(): void {
    this.actionsRow.style.display = 'flex';
    this.actionsRow.style.alignItems = 'center';
    this.actionsRow.style.gap = '4px';
    this.actionsRow.style.flex = '0 0 auto';
    this.actionsRow.style.width = 'max-content';
  }

  /** Builds Bounds / Move / Rotate / Scale / Shear icon buttons once. */
  private buildTransformButtons(): void {
    this.addTransformButton(TransformMode.BOUNDS, IconHammerCatalog.toolbarSvg('transform_bounds'));
    this.addTransformButton(TransformMode.TRANSLATE, IconHammerCatalog.toolbarSvg('transform_move'));
    this.addTransformButton(TransformMode.ROTATE, IconHammerCatalog.toolbarSvg('transform_rotate'));
    this.addTransformButton(TransformMode.SCALE, IconHammerCatalog.toolbarSvg('transform_scale'));
    this.addTransformButton(TransformMode.SHEAR, IconHammerCatalog.toolbarSvg('transform_shear'));
  }

  /**
   * Creates one transform mode icon button.
   *
   * @param mode Transform mode.
   * @param svgIcon Icon markup.
   */
  private addTransformButton(mode: TransformMode, svgIcon: string): void {
    const instruction = toolInstructionForTransformMode(mode);
    const button = createViewportToolRailButton(svgIcon, instruction, () => {
      this.handlers.onTransformMode(mode);
    });
    applyViewportToolOptionsIconButtonMetrics(button);
    this.transformButtons.set(mode, button);
  }

  /**
   * Rebuilds the actions row for the active tool context.
   *
   * @param toolId Active tool.
   */
  private rebuildActionsForTool(toolId: EditorToolId): void {
    this.actionsRow.replaceChildren();
    this.actionsRow.appendChild(this.modeDropdown.getElement());
    if (this.activeInteractionMode === EditorInteractionMode.EDIT_MODE) {
      this.appendEditModeActions();
    } else {
      this.appendObjectModeActionsForTool(toolId);
    }
    this.actionsRowOverflowMark();
  }

  /**
   * Marks every shown control as a toolbar item that may collapse into an
   * overflow menu.
   */
  private actionsRowOverflowMark(): void {
    Array.from(this.actionsRow.children).forEach((child) => {
      if (child instanceof HTMLElement) {
        toolbarOverflowItemMark(child, TOOLBAR_OVERFLOW_PRIORITY_TOOL_OPTIONS, this.overflowProviders.get(child));
      }
    });
  }

  /**
   * Registers the overflow menu stand-ins of the mode and Object dropdowns: a
   * submenu per dropdown with the same entries as its own menu.
   */
  private overflowProvidersDropdownsRegister(): void {
    this.overflowProviders.set(this.modeDropdown.getElement(), () => [
      {
        kind: 'submenu',
        label: getEditorInteractionModeLabel(this.activeInteractionMode),
        children: buildViewportToolModeMenuEntries(this.activeInteractionMode, (mode) =>
          this.handlers.onInteractionMode(mode),
        ),
      },
    ]);
    this.overflowProviders.set(this.objectDropdown.getElement(), () => [
      { kind: 'submenu', label: 'Object', children: this.objectMenuEntriesBuild() },
    ]);
  }

  /**
   * Builds the Object menu entries bound to the current handlers.
   *
   * @returns Object menu entries.
   */
  private objectMenuEntriesBuild(): ToolbarMenuEntry[] {
    return buildViewportToolObjectMenuEntries(
      (kind) => this.handlers.onApplyObjectTransform?.(kind),
      () => this.handlers.onConvexHull?.(),
    );
  }

  /** Appends Edit Mode component toggles, menus, and transform buttons. */
  private appendEditModeActions(): void {
    this.appendComponentModeButtons();
    this.appendEditModeMenus();
    this.appendTransformModeButtons();
  }

  /**
   * Appends Object Mode actions for the selected primary tool.
   *
   * @param toolId Active tool id.
   */
  private appendObjectModeActionsForTool(toolId: EditorToolId): void {
    if (toolId === EditorToolId.FACE) return void this.actionsRow.append(this.faceInspectorButton, this.extrudeButton);
    if (toolId === EditorToolId.CLIP_PLANE)
      return void this.actionsRow.append(this.flipButton, this.clipButton, this.splitButton);
    if (toolId === EditorToolId.GRID) return this.appendGridActions();
    if (toolId === EditorToolId.BLOCK) return this.appendBlockActions();
    if (toolId === EditorToolId.ENTITY)
      return void this.actionsRow.appendChild(this.entityPlaceControls.entityElementRead());
    if (toolId === EditorToolId.POLYGON)
      return void this.actionsRow.appendChild(this.polygonSprinkleControls.polygonElementRead());
    if (toolId === EditorToolId.SPRINKLE)
      return void this.actionsRow.appendChild(this.polygonSprinkleControls.sprinkleElementRead());
    this.appendObjectSelectActions();
  }

  /** Appends shape controls for the Block tool. */
  private appendBlockActions(): void {
    this.actionsRow.appendChild(this.shapeControls.getElement());
    this.shapeControls.selectionRefresh();
  }

  /** Appends Grid tool action buttons. */
  private appendGridActions(): void {
    this.actionsRow.append(
      this.gridResetButton,
      this.gridAlignToFaceButton,
      this.gridAlignXButton,
      this.gridAlignYButton,
      this.gridAlignZButton,
      this.gridOriginVertexButton,
      this.cameraResetButton,
      this.cameraAlignToFaceButton,
    );
    this.applyActiveGridPickModeStyles();
  }

  /** Appends Object Select transform, object, shape, and empty-draw controls. */
  private appendObjectSelectActions(): void {
    this.appendTransformModeButtons();
    this.actionsRow.appendChild(this.objectDropdown.getElement());
    this.actionsRow.appendChild(this.shapeControls.getElement());
    this.actionsRow.appendChild(this.entityPlaceControls.emptyDrawButtonRead());
    this.shapeControls.selectionRefresh();
  }

  /** Appends Bounds / Move / Rotate / Scale / Shear toggles. */
  private appendTransformModeButtons(): void {
    const hideBounds = this.activeInteractionMode === EditorInteractionMode.EDIT_MODE;
    this.transformButtons.forEach((button, mode) => {
      if (hideBounds && isBoundsWidgetMode(mode)) {
        return;
      }
      this.actionsRow.appendChild(button);
    });
    this.setActiveTransformMode(this.activeTransformMode);
  }

  /** Appends Blender-style Mesh / Vertex / Edge / Face menus. */
  private appendEditModeMenus(): void {
    this.actionsRow.appendChild(this.meshDropdown.getElement());
    this.actionsRow.appendChild(this.vertexMenuDropdown.getElement());
    this.actionsRow.appendChild(this.edgeMenuDropdown.getElement());
    this.actionsRow.appendChild(this.faceMenuDropdown.getElement());
  }

  /**
   * Creates one Edit Mode named dropdown.
   *
   * @param parentElement Options bar host.
   * @param label Trigger label.
   * @param buildEntries Menu builder.
   * @returns Dropdown.
   */
  private createEditMenuDropdown(
    parentElement: HTMLElement,
    label: string,
    buildEntries: (actions: ViewportToolEditMenuActions) => ToolbarMenuEntry[],
  ): ViewportToolNamedDropdown {
    const entriesBuild = (): ToolbarMenuEntry[] => buildEntries(this.buildEditMenuActions());
    const dropdown = new ViewportToolNamedDropdown(parentElement, label, entriesBuild);
    this.overflowProviders.set(dropdown.getElement(), () => [{ kind: 'submenu', label, children: entriesBuild() }]);
    return dropdown;
  }

  /**
   * Builds live edit-menu actions from the current handlers.
   *
   * @returns Action bag.
   */
  private buildEditMenuActions(): ViewportToolEditMenuActions {
    return {
      onKnife: () => this.handlers.onEditKnife?.(),
      onLoopCut: () => this.handlers.onEditLoopCut?.(),
      onMerge: (mode) => this.handlers.onEditMerge?.(mode),
      onDelete: () => this.handlers.onEditDelete?.(),
      onDissolve: () => this.handlers.onEditDissolve?.(),
    };
  }

  /** Appends Vertex / Edge / Face toggles for Edit Mode. */
  private appendComponentModeButtons(): void {
    this.componentButtons.forEach((button) => {
      this.actionsRow.appendChild(button);
    });
    this.setActiveComponentMode(this.activeComponentMode);
  }

  /** Builds Vertex / Edge / Face text toggles once. */
  private buildComponentButtons(): void {
    this.addComponentButton(EditorComponentMode.VERTEX, TOOL_INSTRUCTION_COMPONENT_VERTEX);
    this.addComponentButton(EditorComponentMode.EDGE, TOOL_INSTRUCTION_COMPONENT_EDGE);
    this.addComponentButton(EditorComponentMode.FACE, TOOL_INSTRUCTION_COMPONENT_FACE);
  }

  /**
   * Creates one Edit Mode component toggle.
   *
   * @param mode Component mode.
   * @param instruction Tooltip instruction.
   */
  private addComponentButton(mode: EditorComponentMode, instruction: ToolInstruction): void {
    const button = this.createTextAction(getEditorComponentModeLabel(mode), instruction, () => {
      this.handlers.onComponentMode(mode);
    });
    this.componentButtons.set(mode, button);
  }

  /**
   * Creates a labeled text action with a native browser tooltip.
   *
   * @param label Visible label.
   * @param instruction Tooltip instruction.
   * @param onClick Click handler.
   * @returns Button element.
   */
  private createTextAction(label: string, instruction: ToolInstruction, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = formatToolInstructionTooltip(instruction);
    button.setAttribute('aria-label', instruction.title);
    applyViewportToolOptionsTextButtonMetrics(button);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  /** Applies orange active styles to the armed single-use grid/camera button. */
  private applyActiveGridPickModeStyles(): void {
    const mode = this.activeGridPickMode;
    styleViewportToolRailButton(this.gridAlignToFaceButton, mode === 'grid_face');
    styleViewportToolRailButton(this.gridAlignXButton, mode === 'grid_edge_x');
    styleViewportToolRailButton(this.gridAlignYButton, mode === 'grid_edge_y');
    styleViewportToolRailButton(this.gridAlignZButton, mode === 'grid_edge_z');
    styleViewportToolRailButton(this.gridOriginVertexButton, mode === 'grid_origin_vertex');
    styleViewportToolRailButton(this.cameraAlignToFaceButton, mode === 'camera_face');
  }
}
