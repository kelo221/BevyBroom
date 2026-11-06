import * as THREE from 'three';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import { ControllerDisplacementActions } from '@/displacement/controller/controller_displacement_actions.js';
import { PanelDisplacementTab } from '@/displacement/ui/panel_displacement_tab.js';
import {
  displacementTestBoxAdd,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../displacement_test_rig.js';

/** Tab, its stand-in services and the face selection it acts on. */
export interface DisplacementUiTestTab {
  /** Displacement tab under test. */
  tab: PanelDisplacementTab;
  /** Rig whose undo stack the actions use. */
  rig: DisplacementTestRig;
  /** Brush faces the actions apply to; tests change it and call changeNotify. */
  selection: SolidFaceTextureTarget[];
  /** Tells the tab that the selection or the displacements changed. */
  changeNotify: () => void;
  /** Status lines the tab reported. */
  reports: string[];
}

/**
 * Finds a button under a root element by its text.
 *
 * @param root Element to search.
 * @param text Button text.
 * @returns Button element.
 */
export function displacementUiButtonFind(root: HTMLElement, text: string): HTMLButtonElement {
  const button = [...root.querySelectorAll('button')].find((entry) => entry.textContent === text);
  if (!button) throw new Error(`button ${text} missing`);
  return button;
}

/**
 * Finds a field under a root element by its accessible name.
 *
 * @param root Element to search.
 * @param label Accessible name.
 * @returns Field element.
 */
export function displacementUiFieldFind<T extends HTMLElement>(root: HTMLElement, label: string): T {
  const field = root.querySelector<T>(`[aria-label="${label}"]`);
  if (!field) throw new Error(`field ${label} missing`);
  return field;
}

/**
 * Types a value into a field and commits it.
 *
 * @param field Text or range input.
 * @param value Text to enter.
 */
export function displacementUiFieldCommit(field: HTMLInputElement, value: string): void {
  field.value = value;
  field.dispatchEvent(new Event('change'));
}

/**
 * Creates a Displacement tab over a rig whose selection the test controls.
 *
 * @param rigName Solid model name.
 * @returns Tab, rig, selection and change notifier.
 */
export function displacementUiTabCreate(rigName: string): DisplacementUiTestTab {
  const rig = displacementTestRigCreate(rigName);
  const selection: SolidFaceTextureTarget[] = [];
  const listeners = new Set<() => void>();
  const reports: string[] = [];
  const actions = new ControllerDisplacementActions(rig.commandStack, () => selection.slice());
  const tab = new PanelDisplacementTab({
    actionsRead: () => actions,
    changeListenerAdd: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    floatingHost: document.body,
    statusReport: (message) => reports.push(message),
    afterChange: () => undefined,
  });
  return { tab, rig, selection, changeNotify: () => listeners.forEach((listener) => listener()), reports };
}

/**
 * Adds a box to a rig and returns the face pointing up.
 *
 * @param rig Test rig.
 * @param center World center of the box.
 * @returns Top face target.
 */
export function displacementUiTopFaceAdd(rig: DisplacementTestRig, center: THREE.Vector3): SolidFaceTextureTarget {
  const brush = displacementTestBoxAdd(rig, new THREE.Vector3(2, 1, 2), center);
  return displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)));
}
