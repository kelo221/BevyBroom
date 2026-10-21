import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { CommandStack } from '@/commands/command_stack.js';
import { UndoCommand } from '@/commands/command_undo.js';
import { CommandTransformPositionSet } from '@/transform/commands/command_transform_position_set.js';
import { CommandTransformRotationSet } from '@/transform/commands/command_transform_rotation_set.js';
import { CommandTransformScaleSet } from '@/transform/commands/command_transform_scale_set.js';
import { TextureLockSettings } from '@/texture/lock/texture_lock_settings.js';
import { filterUnlockedObjects } from '@/utils/object_lock.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import {
  PanelPropertiesSolidBrushSection,
  SolidBrushPropertyHandlers,
} from './panel_properties_solid_brush_section.js';
import { PanelPropertiesColorSession } from './panel_properties_color_session.js';
import { PanelPropertiesChrome } from './panel_properties_chrome.js';
import { PanelPropertiesMaterialSection } from './panel_properties_material_section.js';
import { InputNumeric } from '@/ui/input/input_numeric.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { entityScaleAbsorbCommandWrap } from '@/entity/commands/command_entity_scale_absorb.js';
import { entityScaleAbsorbsAll } from '@/entity/scale/entity_scale_absorb.js';
import {
  panelPropertiesAreObjectPositionsUnchanged,
  panelPropertiesAreObjectRotationsUnchanged,
  panelPropertiesAreObjectScalesUnchanged,
  panelPropertiesEulerDegrees,
  panelPropertiesResolveAxisNumbers,
  type PanelPropertiesAxisNumbers,
} from './panel_properties_numbers.js';

export type { SolidBrushPropertyHandlers };

/** Configuration for a single axis input row in a property section. */
interface AxisInputConfig {
  label: string;
  color: string;
  axis: 'x' | 'y' | 'z';
}

/**
 * Right-side properties panel with Position, Rotation, Scale, and Material.
 * Supports multi-selection: mixed fields show dashes; edits apply to all
 * selected objects (Unity-style inspector behavior).
 */
export class PanelProperties {
  private container: HTMLElement;
  private theme: typeof Theme;
  private selectionManager: ManagerSelection;
  private boundObjects: THREE.Object3D[];
  private positionInputs: Map<string, InputNumeric>;
  private rotationInputs: Map<string, InputNumeric>;
  private scaleInputs: Map<string, InputNumeric>;
  private scaleSection: HTMLElement | null;
  private readonly chrome: PanelPropertiesChrome;
  private readonly materialSection: PanelPropertiesMaterialSection;
  private commandStack: CommandStack | null;
  private textureLock: TextureLockSettings | null;
  private isDisposed: boolean;
  private sections: HTMLElement[];
  private colorSession: PanelPropertiesColorSession;
  private solidBrushSection: PanelPropertiesSolidBrushSection;
  /**
   * Layout callback after inspector transform commands. Must refresh selection
   * outlines, brush hulls, CAD rulers, and gizmo (same contract as undo/redo).
   */
  private afterTransformCommit: ((objects: THREE.Object3D[]) => void) | null;

  /**
   * Creates a new properties panel.
   *
   * @param container The parent DOM element to append the panel into.
   * @param theme The theme containing color definitions.
   * @param selectionManager The selection manager to bind to.
   */
  constructor(container: HTMLElement, theme: typeof Theme, selectionManager: ManagerSelection) {
    this.container = document.createElement('div');
    this.theme = theme;
    this.selectionManager = selectionManager;
    this.boundObjects = [];
    this.positionInputs = new Map();
    this.rotationInputs = new Map();
    this.scaleInputs = new Map();
    this.scaleSection = null;
    this.chrome = new PanelPropertiesChrome();
    this.commandStack = null;
    this.textureLock = null;
    this.isDisposed = false;
    this.sections = [];
    this.colorSession = new PanelPropertiesColorSession();
    this.materialSection = new PanelPropertiesMaterialSection(this.chrome, this.colorSession, () =>
      this.getEditableBoundObjects(),
    );
    this.afterTransformCommit = null;
    this.solidBrushSection = this.solidBrushSectionCreate();
    this.applyContainerStyles();
    this.createPositionSection();
    this.createRotationSection();
    this.createScaleSection();
    this.createMaterialSection();
    this.mountSolidBrushSection();
    container.appendChild(this.container);
    this.bindSelectionChanges();
  }

  /**
   * Creates the solid brush section, editing the bound brush meshes that are
   * not locked.
   *
   * @returns The solid brush section.
   */
  private solidBrushSectionCreate(): PanelPropertiesSolidBrushSection {
    const section = new PanelPropertiesSolidBrushSection(
      this.theme,
      () => this.chrome.createSectionContainer(),
      (title) => this.chrome.createSectionHeader(title),
      hexToRgb,
    );
    section.setEditableBrushMeshProvider(() =>
      this.getEditableBoundObjects().filter(
        (object): object is THREE.Mesh => object instanceof THREE.Mesh && SolidBrushVisual.isBrushObject(object),
      ),
    );
    return section;
  }

  /**
   * Wires solid-brush operation and rebuild handlers from the layout.
   *
   * @param handlers Brush property handlers, or null to clear.
   */
  setSolidBrushHandlers(handlers: SolidBrushPropertyHandlers | null): void {
    this.solidBrushSection.setHandlers(handlers);
  }

  /**
   * Sets the callback invoked after position/rotation/scale commands commit.
   * Layout must refresh multi-viewport visuals here — transforms alone leave
   * outlines, hulls, and CAD rulers desynced.
   *
   * @param callback Receives the objects that were transformed, or null.
   */
  setAfterTransformCommit(callback: ((objects: THREE.Object3D[]) => void) | null): void {
    this.afterTransformCommit = callback;
  }

  /**
   * Sets the command stack for undo/redo support on property edits.
   *
   * @param stack The command stack to use for property changes.
   */
  setCommandStack(stack: CommandStack): void {
    this.commandStack = stack;
    this.colorSession.setCommandStack(stack);
    this.solidBrushSection.setCommandStack(stack);
  }

  /**
   * Sets texture lock settings for scale edits from the inspector.
   *
   * @param settings Shared texture lock settings, or null.
   */
  setTextureLockSettings(settings: TextureLockSettings | null): void {
    this.textureLock = settings;
  }

  /**
   * Binds the panel to a single object for editing.
   *
   * @param object The Three.js object to bind to.
   */
  bindObject(object: THREE.Object3D): void {
    this.bindObjects([object]);
  }

  /**
   * Binds the panel to multiple objects for multi-edit.
   *
   * @param objects The objects currently selected.
   */
  bindObjects(objects: THREE.Object3D[]): void {
    this.colorSession.finalize();
    this.boundObjects = objects.slice();
    this.updateFromObjects(this.boundObjects);
  }

  /** Unbinds the panel from any objects and clears inputs. */
  unbindObject(): void {
    this.colorSession.finalize();
    this.boundObjects = [];
    this.clearAllInputs();
    this.solidBrushSection.updateFromObjects([]);
  }

  /**
   * Re-reads transform values from the currently bound objects. Call during
   * gizmo drags so position/rotation/scale inputs stay live.
   */
  refreshBoundObject(): void {
    if (this.isDisposed || this.boundObjects.length === 0) return;
    this.updateFromObjects(this.boundObjects);
  }

  /**
   * Updates all input values from one object (single-selection helper).
   *
   * @param object The Three.js object to read values from.
   */
  updateFromObject(object: THREE.Object3D): void {
    this.updateFromObjects([object]);
  }

  /**
   * Updates inputs from multiple objects, showing dashes for mixed fields.
   *
   * @param objects Objects in the current selection.
   */
  updateFromObjects(objects: THREE.Object3D[]): void {
    if (objects.length === 0) {
      this.clearAllInputs();
      this.solidBrushSection.updateFromObjects([]);
      return;
    }
    this.transformInputsWrite(objects);
    this.materialSection.updateFromObjects(objects);
    this.scaleSectionVisibilityWrite(objects);
    this.solidBrushSection.updateFromObjects(objects);
  }

  /**
   * Writes the position, rotation and scale inputs from the objects, showing
   * dashes for mixed fields.
   *
   * @param objects Objects in the current selection.
   */
  private transformInputsWrite(objects: readonly THREE.Object3D[]): void {
    this.writeVectorInputs(
      this.positionInputs,
      objects.map((object) => object.position),
      2,
    );
    this.writeVectorInputs(
      this.rotationInputs,
      objects.map((object) => panelPropertiesEulerDegrees(object.rotation)),
      1,
    );
    this.writeVectorInputs(
      this.scaleInputs,
      objects.map((object) => object.scale),
      2,
    );
  }

  /**
   * Hides the Scale section when every object turns scale edits into its
   * settings, such as lights whose scale changes their radius.
   *
   * @param objects Objects in the current selection.
   */
  private scaleSectionVisibilityWrite(objects: readonly THREE.Object3D[]): void {
    if (this.scaleSection) {
      this.scaleSection.style.display = entityScaleAbsorbsAll(objects) ? 'none' : 'block';
    }
  }

  /** Disposes the panel and removes it from the DOM. */
  dispose(): void {
    this.isDisposed = true;
    this.colorSession.finalize();
    this.disposeNumericInputs(this.positionInputs);
    this.disposeNumericInputs(this.rotationInputs);
    this.disposeNumericInputs(this.scaleInputs);
    this.sections = [];
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  /**
   * Disposes every numeric field in a section map.
   *
   * @param inputMap Axis numeric fields.
   */
  private disposeNumericInputs(inputMap: Map<string, InputNumeric>): void {
    for (const field of inputMap.values()) {
      field.dispose();
    }
    inputMap.clear();
  }

  /**
   * Returns the container element for layout purposes.
   *
   * @returns The DOM element of the panel.
   */
  getContainer(): HTMLElement {
    return this.container;
  }

  /**
   * Writes shared or mixed axis values into an input map.
   *
   * @param inputMap Axis inputs to update.
   * @param vectors Per-object vector values (position/scale/degrees).
   * @param minDecimals Minimum fractional digits for shared numbers.
   */
  private writeVectorInputs(inputMap: Map<string, InputNumeric>, vectors: THREE.Vector3[], minDecimals: number): void {
    this.writeAxisInput(
      inputMap,
      'x',
      vectors.map((vector) => vector.x),
      minDecimals,
    );
    this.writeAxisInput(
      inputMap,
      'y',
      vectors.map((vector) => vector.y),
      minDecimals,
    );
    this.writeAxisInput(
      inputMap,
      'z',
      vectors.map((vector) => vector.z),
      minDecimals,
    );
  }

  /**
   * Writes one axis field as a shared number or mixed dash.
   *
   * @param inputMap Input map.
   * @param axis Axis key.
   * @param values Per-object values for this axis.
   * @param minDecimals Minimum fractional digits when shared.
   */
  private writeAxisInput(
    inputMap: Map<string, InputNumeric>,
    axis: string,
    values: number[],
    minDecimals: number,
  ): void {
    const field = inputMap.get(axis);
    if (!field) {
      return;
    }
    field.setSharedValues(values, minDecimals);
  }

  /**
   * Applies position edits from the panel to all bound objects. Only axes with
   * valid numbers are written (mixed axes keep per-object values).
   */
  private applyPositionCommand(): void {
    const editable = this.getEditableBoundObjects();
    if (editable.length === 0) {
      return;
    }
    const axes = this.readSectionAxisNumbers(this.positionInputs);
    if (!axes) {
      return;
    }
    this.applyPositionFromAxisNumbers(editable, axes);
  }

  /**
   * Writes resolved position axis numbers onto unlocked bound objects.
   *
   * @param editable Unlocked bound objects.
   * @param axes Parsed axis numbers (null keeps the object value).
   */
  private applyPositionFromAxisNumbers(editable: THREE.Object3D[], axes: PanelPropertiesAxisNumbers): void {
    const positions = editable.map((object) => this.buildPositionFromAxisNumbers(object, axes));
    if (panelPropertiesAreObjectPositionsUnchanged(editable, positions)) {
      this.refreshBoundObjectInputs();
      return;
    }
    this.pushOrExecute(new CommandTransformPositionSet(editable, positions));
    this.applyBoundContentTexturePolicy(true, false);
    this.commitTransformSideEffects(editable);
  }

  /**
   * Builds a next position from one object and optional axis overrides.
   *
   * @param object Source object.
   * @param axes Axis overrides.
   * @returns Cloned position with overrides applied.
   */
  private buildPositionFromAxisNumbers(object: THREE.Object3D, axes: PanelPropertiesAxisNumbers): THREE.Vector3 {
    const next = object.position.clone();
    if (axes.x !== null) {
      next.x = axes.x;
    }
    if (axes.y !== null) {
      next.y = axes.y;
    }
    if (axes.z !== null) {
      next.z = axes.z;
    }
    return next;
  }

  /** Applies rotation edits (degrees in the UI) to unlocked bound objects. */
  private applyRotationCommand(): void {
    const editable = this.getEditableBoundObjects();
    if (editable.length === 0) {
      return;
    }
    const axes = this.readSectionAxisNumbers(this.rotationInputs);
    if (!axes) {
      return;
    }
    this.applyRotationFromAxisNumbers(editable, axes);
  }

  /**
   * Writes resolved rotation axis numbers (degrees) onto unlocked bound
   * objects.
   *
   * @param editable Unlocked bound objects.
   * @param axes Parsed degree axis numbers (null keeps the object value).
   */
  private applyRotationFromAxisNumbers(editable: THREE.Object3D[], axes: PanelPropertiesAxisNumbers): void {
    const rotations = editable.map((object) => this.buildRotationFromAxisNumbers(object, axes));
    if (panelPropertiesAreObjectRotationsUnchanged(editable, rotations)) {
      this.refreshBoundObjectInputs();
      return;
    }
    this.pushOrExecute(new CommandTransformRotationSet(editable, rotations));
    this.applyBoundContentTexturePolicy(true, false);
    this.commitTransformSideEffects(editable);
  }

  /**
   * Builds a next Euler rotation from one object and optional degree overrides.
   *
   * @param object Source object.
   * @param axes Degree axis overrides.
   * @returns Euler rotation in radians.
   */
  private buildRotationFromAxisNumbers(object: THREE.Object3D, axes: PanelPropertiesAxisNumbers): THREE.Euler {
    const rx = axes.x !== null ? THREE.MathUtils.degToRad(axes.x) : object.rotation.x;
    const ry = axes.y !== null ? THREE.MathUtils.degToRad(axes.y) : object.rotation.y;
    const rz = axes.z !== null ? THREE.MathUtils.degToRad(axes.z) : object.rotation.z;
    return new THREE.Euler(rx, ry, rz, 'XYZ');
  }

  /** Applies scale edits to unlocked bound objects. */
  private applyScaleCommand(): void {
    const editable = this.getEditableBoundObjects();
    if (editable.length === 0) {
      return;
    }
    const axes = this.readSectionAxisNumbers(this.scaleInputs);
    if (!axes) {
      return;
    }
    this.applyScaleFromAxisNumbers(editable, axes);
  }

  /**
   * Writes resolved scale axis numbers onto unlocked bound objects.
   *
   * @param editable Unlocked bound objects.
   * @param axes Parsed axis numbers (null keeps the object value).
   */
  private applyScaleFromAxisNumbers(editable: THREE.Object3D[], axes: PanelPropertiesAxisNumbers): void {
    const scales = editable.map((object) => this.buildScaleFromAxisNumbers(object, axes));
    if (panelPropertiesAreObjectScalesUnchanged(editable, scales)) {
      this.refreshBoundObjectInputs();
      return;
    }
    this.prepareBoundContentMeshesForTextureOps();
    this.pushOrExecute(entityScaleAbsorbCommandWrap(new CommandTransformScaleSet(editable, scales), editable));
    this.applyBoundContentTexturePolicy(false, true);
    this.commitTransformSideEffects(editable);
  }

  /**
   * Builds a next scale from one object and optional axis overrides.
   *
   * @param object Source object.
   * @param axes Axis overrides.
   * @returns Cloned scale with overrides applied.
   */
  private buildScaleFromAxisNumbers(object: THREE.Object3D, axes: PanelPropertiesAxisNumbers): THREE.Vector3 {
    const next = object.scale.clone();
    if (axes.x !== null) {
      next.x = axes.x;
    }
    if (axes.y !== null) {
      next.y = axes.y;
    }
    if (axes.z !== null) {
      next.z = axes.z;
    }
    return next;
  }

  /**
   * Reads X/Y/Z text from a section. Invalid math resets the UI and returns
   * null.
   *
   * @param inputMap Axis inputs for one transform section.
   * @returns Resolved axis numbers, or null when invalid or all skipped.
   */
  private readSectionAxisNumbers(inputMap: Map<string, InputNumeric>): PanelPropertiesAxisNumbers | null {
    const resolved = panelPropertiesResolveAxisNumbers(
      this.axisInputText(inputMap, 'x'),
      this.axisInputText(inputMap, 'y'),
      this.axisInputText(inputMap, 'z'),
    );
    if (resolved.kind === 'invalid') {
      this.refreshBoundObjectInputs();
      return null;
    }
    if (resolved.kind === 'skip_all') {
      return null;
    }
    return resolved.axes;
  }

  /**
   * Returns the text of one axis input, or empty when missing.
   *
   * @param inputMap Axis inputs.
   * @param axis Axis key.
   * @returns Input value text.
   */
  private axisInputText(inputMap: Map<string, InputNumeric>, axis: string): string {
    const field = inputMap.get(axis);
    if (!field) {
      return '';
    }
    return field.getText();
  }

  /** Re-reads bound object transforms into all inspector inputs. */
  private refreshBoundObjectInputs(): void {
    this.updateFromObjects(this.boundObjects);
  }

  /**
   * Runs post-transform side effects after an inspector pose write: solid CSG
   * finalize (via layout callback), multi-viewport visual sync, then re-read
   * inputs from the live bound objects.
   *
   * @param objects Objects that received the transform command.
   */
  private commitTransformSideEffects(objects: THREE.Object3D[]): void {
    this.afterTransformCommit?.(objects);
    this.updateFromObjects(this.boundObjects);
  }

  /**
   * Returns bound objects that are not locked for editing.
   *
   * @returns Unlocked bound objects.
   */
  private getEditableBoundObjects(): THREE.Object3D[] {
    return filterUnlockedObjects(this.boundObjects);
  }

  /**
   * Applies content texture lock policy after an inspector pose write.
   *
   * @param moved True when translation/rotation changed.
   * @param scaled True when scale changed.
   */
  private applyBoundContentTexturePolicy(moved: boolean, scaled: boolean): void {
    if (!this.textureLock) return;
    this.textureLock.applyContentTransformPolicy(this.getEditableBoundMeshes(), moved, scaled);
  }

  /**
   * Heals stale content UV matrices on bound meshes before a pose write that
   * may world-rebake (inspector scale).
   */
  private prepareBoundContentMeshesForTextureOps(): void {
    if (!this.textureLock) return;
    this.textureLock.prepareContentMeshesForTextureOps(this.getEditableBoundMeshes());
  }

  /**
   * Returns editable bound objects that are meshes.
   *
   * @returns Content and brush meshes currently bound in the panel.
   */
  private getEditableBoundMeshes(): THREE.Mesh[] {
    return this.getEditableBoundObjects().filter((object): object is THREE.Mesh => object instanceof THREE.Mesh);
  }

  /**
   * Pushes a command through the stack, or executes it directly.
   *
   * @param command Undoable command to run.
   */
  private pushOrExecute(command: UndoCommand): void {
    if (this.commandStack) {
      this.commandStack.push(command);
      return;
    }
    command.execute();
  }

  /** Applies styles to the panel container. */
  private applyContainerStyles(): void {
    this.container.classList.add('editor-properties-panel');
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.overflow = 'hidden';
    this.container.style.background = hexToRgb(Theme.propertiesPanelBackground);
    this.container.style.borderLeft = `2px solid ${hexToRgb(Theme.separatorColor)}`;
    this.container.style.width = '200px';
    this.container.style.minWidth = '200px';
    this.container.style.userSelect = 'none';
  }

  /** Creates the Position collapsible section. */
  private createPositionSection(): void {
    const section = this.createSection(
      'Position',
      [
        { label: 'x', axis: 'x', color: this.axisColor(Theme.gizmoXAxisColor) },
        { label: 'y', axis: 'y', color: this.axisColor(Theme.gizmoYAxisColor) },
        { label: 'z', axis: 'z', color: this.axisColor(Theme.gizmoZAxisColor) },
      ],
      this.positionInputs,
    );
    this.sections.push(section);
    this.container.appendChild(section);
  }

  /** Creates the Rotation collapsible section. */
  private createRotationSection(): void {
    const section = this.createSection(
      'Rotation',
      [
        { label: 'x', axis: 'x', color: this.axisColor(Theme.gizmoXAxisColor) },
        { label: 'y', axis: 'y', color: this.axisColor(Theme.gizmoYAxisColor) },
        { label: 'z', axis: 'z', color: this.axisColor(Theme.gizmoZAxisColor) },
      ],
      this.rotationInputs,
    );
    this.sections.push(section);
    this.container.appendChild(section);
  }

  /** Creates the Scale collapsible section. */
  private createScaleSection(): void {
    const section = this.createSection(
      'Scale',
      [
        { label: 'x', axis: 'x', color: this.axisColor(Theme.gizmoXAxisColor) },
        { label: 'y', axis: 'y', color: this.axisColor(Theme.gizmoYAxisColor) },
        { label: 'z', axis: 'z', color: this.axisColor(Theme.gizmoZAxisColor) },
      ],
      this.scaleInputs,
    );
    this.scaleSection = section;
    this.sections.push(section);
    this.container.appendChild(section);
  }

  /**
   * Formats a theme hex color as a CSS #rrggbb string.
   *
   * @param hex Theme color number.
   * @returns CSS color string.
   */
  private axisColor(hex: number): string {
    return '#' + hex.toString(16).padStart(6, '0');
  }

  /** Mounts the Material color section for mesh color editing. */
  private createMaterialSection(): void {
    const section = this.materialSection.getElement();
    this.sections.push(section);
    this.container.appendChild(section);
  }

  /** Mounts the solid brush section into the panel. */
  private mountSolidBrushSection(): void {
    const element = this.solidBrushSection.getElement();
    this.sections.push(element);
    this.container.appendChild(element);
  }

  /**
   * Creates a collapsible section with axis inputs.
   *
   * @param title The section title.
   * @param axes The axis configuration for each row.
   * @param inputMap The map to store input references.
   * @returns The created section element.
   */
  private createSection(title: string, axes: AxisInputConfig[], inputMap: Map<string, InputNumeric>): HTMLElement {
    const section = this.chrome.createSectionContainer();
    const header = this.chrome.createSectionHeader(title);
    section.appendChild(header);
    const content = this.createSectionContent(axes, inputMap);
    section.appendChild(content);
    this.chrome.sectionToggleBind(header, content);
    return section;
  }

  /**
   * Creates the content container with axis input rows.
   *
   * @param axes The axis configuration for each row.
   * @param inputMap The map to store input references.
   * @returns The styled content element.
   */
  private createSectionContent(axes: AxisInputConfig[], inputMap: Map<string, InputNumeric>): HTMLElement {
    const content = document.createElement('div');
    content.style.paddingLeft = '4px';
    axes.forEach((axisConfig) => {
      const row = this.createAxisRow(axisConfig.label.toUpperCase(), axisConfig.color, axisConfig.axis, inputMap);
      content.appendChild(row);
    });
    return content;
  }

  /**
   * Creates a single axis input row with label and number input.
   *
   * @param label The axis label (X, Y, Z).
   * @param color The label color.
   * @param axis The axis identifier.
   * @param inputMap The map to store the input reference.
   * @returns The row element.
   */
  private createAxisRow(label: string, color: string, axis: string, inputMap: Map<string, InputNumeric>): HTMLElement {
    const row = this.createAxisRowContainer();
    const labelEl = this.createAxisLabel(label, color);
    const field = this.createAxisInput(axis, inputMap);
    row.appendChild(labelEl);
    row.appendChild(field.getElement());
    return row;
  }

  /**
   * Creates the container element for an axis row.
   *
   * @returns The styled row container.
   */
  private createAxisRowContainer(): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '4px';
    row.style.marginBottom = '2px';
    return row;
  }

  /**
   * Creates the axis label span element.
   *
   * @param label The axis label text.
   * @param color The label text color.
   * @returns The styled label element.
   */
  private createAxisLabel(label: string, color: string): HTMLElement {
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.color = color;
    labelEl.style.fontSize = '11px';
    labelEl.style.fontFamily = 'monospace';
    labelEl.style.width = '12px';
    return labelEl;
  }

  /**
   * Creates a shared numeric field for an axis (supports mixed "—" display and
   * arithmetic expressions).
   *
   * @param axis The axis identifier.
   * @param inputMap The map to store the field reference.
   * @returns The numeric field controller.
   */
  private createAxisInput(axis: string, inputMap: Map<string, InputNumeric>): InputNumeric {
    const field = new InputNumeric({ width: '100%' });
    inputMap.set(axis, field);
    this.bindNumericFieldCommit(field, inputMap);
    return field;
  }

  /**
   * Binds a numeric field to apply multi-object changes on commit.
   *
   * @param field Axis numeric field.
   * @param inputMap The input map this belongs to.
   */
  private bindNumericFieldCommit(field: InputNumeric, inputMap: Map<string, InputNumeric>): void {
    field.bindCommit(() => {
      if (this.boundObjects.length === 0) {
        return;
      }
      if (inputMap === this.positionInputs) {
        this.applyPositionCommand();
      }
      if (inputMap === this.rotationInputs) {
        this.applyRotationCommand();
      }
      if (inputMap === this.scaleInputs) {
        this.applyScaleCommand();
      }
    });
  }

  /** Binds selection change events to update the panel for multi-select. */
  private bindSelectionChanges(): void {
    this.selectionManager.onSelectionChanged(() => {
      if (this.isDisposed) return;
      const selected = this.selectionManager.getInspectorObjects();
      if (selected.length > 0) {
        this.bindObjects(selected);
        return;
      }
      this.unbindObject();
    });
  }

  /** Clears all input values to empty strings. */
  private clearAllInputs(): void {
    this.clearNumericInputMap(this.positionInputs);
    this.clearNumericInputMap(this.rotationInputs);
    this.clearNumericInputMap(this.scaleInputs);
    this.materialSection.clear();
    this.scaleSectionVisibilityWrite([]);
  }

  /**
   * Clears every field in a numeric input map.
   *
   * @param inputMap Axis numeric fields.
   */
  private clearNumericInputMap(inputMap: Map<string, InputNumeric>): void {
    for (const field of inputMap.values()) {
      field.setText('');
    }
  }
}
