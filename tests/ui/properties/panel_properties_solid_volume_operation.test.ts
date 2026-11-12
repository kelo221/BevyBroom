import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { PanelProperties } from '@/ui/properties/panel_properties.js';
import { SolidModelController } from '@/solid/controller/solid_model_controller.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation, solidOperationLabel } from '@/solid/types/solid_operation.js';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import { modifierBevelRefreshScene } from '@/modifier/compile/modifier_bevel_scene_refresh.js';
import { buttonClassicPressedApply } from '@/ui/button/button_classic_style.js';
import { stackResultBounds } from '../../modifier/stack/modifier_stack_fixture.js';
import { findSolidModelSection } from './panel_properties_solid_section_helpers.js';

/** Edge length of the brush the volume cuts. */
const VOLUME_TEST_BRUSH_SIZE = 2;

/** Stand-in for the solid model panel the controller refreshes. */
class VolumeTestSolidPanel {
  /** Does nothing; the test reads the scene directly. */
  refresh(): void {
    return;
  }

  /** Does nothing; the controller only remembers the active model. */
  setModel(): void {
    return;
  }

  /**
   * Returns no active model.
   *
   * @returns Null.
   */
  getModel(): SolidModel | null {
    return null;
  }
}

/**
 * Builds a world with one additive box brush and a volume covering its +X half,
 * a properties panel wired to a real solid model controller the way the layout
 * wires it, and the volume selected.
 *
 * @returns Rig parts.
 */
function volumeOperationRig() {
  const world = new THREE.Group();
  const selection = new ManagerSelection();
  const commandStack = new CommandStack(16);
  const controller = new SolidModelController(world, commandStack, selection, new VolumeTestSolidPanel() as never);
  const model = new SolidModel('Volume operation buttons');
  world.add(model.root);
  model.addBoxBrush(VOLUME_TEST_BRUSH_SIZE, SolidOperation.Additive);
  const volume = ModifierVolume.create({ modifiers: [] });
  volume.position.x = VOLUME_TEST_BRUSH_SIZE / 2;
  volume.scale.set(VOLUME_TEST_BRUSH_SIZE, VOLUME_TEST_BRUSH_SIZE * 2, VOLUME_TEST_BRUSH_SIZE * 2);
  world.add(volume);
  world.updateMatrixWorld(true);
  modifierBevelRefreshScene(world);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const panel = new PanelProperties(Theme, selection);
  panel.hostAttach(container);
  panel.setSolidBrushHandlers(volumeOperationHandlers(controller));
  panel.bindObjects([volume]);
  return { model, volume, panel, commandStack };
}

/**
 * Returns the solid section handlers the layout installs, backed by a
 * controller.
 *
 * @param controller Solid model controller.
 * @returns Handlers.
 */
function volumeOperationHandlers(controller: SolidModelController) {
  return {
    onSetOperation: (meshes: THREE.Mesh[], operation: SolidOperation) =>
      controller.setBrushOperationForMeshes(meshes, operation),
    onSetVolumeOperation: (volumes: THREE.Object3D[], operation: SolidOperation) =>
      controller.setVolumeOperationForVolumes(volumes, operation),
    onAddBoxBrush: () => controller.addBoxBrush(),
    onMoveToFirst: () => undefined,
    onMoveToLast: () => undefined,
  };
}

/**
 * Finds the operation button of a CSG operation in the solid section.
 *
 * @param section Solid Model section.
 * @param operation CSG operation.
 * @returns Button.
 */
function operationButton(section: HTMLElement, operation: SolidOperation): HTMLButtonElement {
  const button = section.querySelector<HTMLButtonElement>(`button[aria-label="${solidOperationLabel(operation)}"]`);
  if (!button) throw new Error(`No ${solidOperationLabel(operation)} button`);
  return button;
}

/**
 * Returns whether a button shows the pressed classic style.
 *
 * @param button Button.
 * @returns True when pressed.
 */
function operationButtonIsPressed(button: HTMLButtonElement): boolean {
  const probe = document.createElement('button');
  buttonClassicPressedApply(probe, true);
  return button.style.background === probe.style.background;
}

/**
 * Returns the shown Solid Model section of the rig's panel.
 *
 * @param panel Properties panel.
 * @returns Section.
 */
function solidSection(panel: PanelProperties): HTMLElement {
  const section = findSolidModelSection(panel.getContainer());
  if (!section) throw new Error('No Solid Model section');
  return section;
}

describe('Solid Model section operation buttons on modifier volumes', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('shows only the operation buttons for a selection of modifier volumes, none pressed for no operation', () => {
    const rig = volumeOperationRig();
    const section = solidSection(rig.panel);
    expect(section.style.display).toBe('block');
    const invertedWorld = section.querySelector('input[type="checkbox"]')?.closest('label');
    expect(invertedWorld?.style.display).toBe('none');
    const pressed = [SolidOperation.Additive, SolidOperation.Subtractive, SolidOperation.Intersecting].filter(
      (operation) => operationButtonIsPressed(operationButton(section, operation)),
    );
    expect(pressed).toEqual([]);
    rig.panel.dispose();
  });

  it('stores Subtractive on the volume as one undo step, cuts the solid and shows the button pressed', () => {
    const rig = volumeOperationRig();
    const whole = stackResultBounds(rig.model);
    operationButton(solidSection(rig.panel), SolidOperation.Subtractive).click();
    expect(ModifierVolume.read(rig.volume).operation).toBe('subtract');
    expect(stackResultBounds(rig.model).max.x).toBeCloseTo(whole.getCenter(new THREE.Vector3()).x, 3);
    expect(operationButtonIsPressed(operationButton(solidSection(rig.panel), SolidOperation.Subtractive))).toBe(true);
    expect(rig.commandStack.undo()).toBe(true);
    expect(ModifierVolume.read(rig.volume).operation).toBe('none');
    expect(stackResultBounds(rig.model).max.x).toBeCloseTo(whole.max.x, 3);
    rig.panel.dispose();
  });
});
