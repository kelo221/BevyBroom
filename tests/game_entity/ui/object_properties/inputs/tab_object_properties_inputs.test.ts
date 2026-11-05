import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { TabObjectPropertiesInputs } from '@/game_entity/ui/object_properties/inputs/tab_object_properties_inputs.js';
import type { ObjectPropertiesTabInstance } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import {
  objectPropertiesTestContextCreate,
  type ObjectPropertiesTestContext,
} from '../../../../ui/object_properties/object_properties_test_support.js';
import {
  logicTestClassesInstall,
  logicTestRowCreate,
  logicTestSceneCreate,
  type LogicTestScene,
} from '../../../logic/game_entity_logic_test_support.js';
import { logicTestButtonClick, logicTestTableRowsRead } from '../object_properties_logic_test_support.js';

/** Mounted Inputs tab with its scene and context. */
interface InputsTabRig {
  readonly tab: ObjectPropertiesTabInstance;
  readonly scene: LogicTestScene;
  readonly test: ObjectPropertiesTestContext;
  readonly door: THREE.Object3D;
}

/**
 * Builds a button wired to the first of two doors by its exact name and to both
 * by a wildcard, and mounts the Inputs tab on the first door.
 *
 * @returns Mounted tab rig.
 */
function inputsTabRigCreate(): InputsTabRig {
  const scene = logicTestSceneCreate(2);
  const door = scene.doors[0] as THREE.Object3D;
  const test = objectPropertiesTestContextCreate([door]);
  test.worldObject.add(scene.button, ...scene.doors);
  GameEntityLogicStore.write(scene.button, [
    logicTestRowCreate({ output: 'OnPressed', target: door.name, input: 'Open', delay: 0.5, times_to_fire: 1 }),
    logicTestRowCreate({ output: 'OnReleased', target: 'door_*', input: 'Close', parameter: 'slow' }),
    logicTestRowCreate({ output: 'OnPressed', target: 'somewhere_else', input: 'Open' }),
  ]);
  const tab = TabObjectPropertiesInputs.registrationCreate().mount(test.context);
  tab.refresh([door]);
  return { tab, scene, test, door };
}

/**
 * The Inputs tab lists every connection in the scene that reaches the edited
 * object and marks the object firing a connection on Mark or double-click.
 */
describe('TabObjectPropertiesInputs', () => {
  let uninstall: () => void = () => {};
  let rig: InputsTabRig | null = null;

  beforeEach(() => {
    uninstall = logicTestClassesInstall();
  });

  afterEach(() => {
    rig?.tab.dispose();
    rig = null;
    uninstall();
  });

  it('lists the incoming connections with source, output, input, delay, once and parameter', () => {
    rig = inputsTabRigCreate();
    const rows = logicTestTableRowsRead(rig.test.context.container, 'Inputs');
    const texts = rows.map((row) => Array.from(row.cells, (cell) => cell.textContent));
    const sourceName = rig.scene.button.name;
    expect(texts).toEqual([
      [sourceName, 'OnPressed', 'Open', '0.50', 'Yes', ''],
      [sourceName, 'OnReleased', 'Close', '0.00', 'No', 'slow'],
    ]);
  });

  it('marks the source of the selected connection', () => {
    rig = inputsTabRigCreate();
    logicTestTableRowsRead(rig.test.context.container, 'Inputs')[1]?.click();
    logicTestButtonClick(rig.test.context.container, 'mark-source');
    expect(rig.test.markRequests).toEqual([{ objects: [rig.scene.button], shouldFrame: false }]);
  });

  it('marks and frames the source of a double-clicked connection', () => {
    rig = inputsTabRigCreate();
    const [row] = logicTestTableRowsRead(rig.test.context.container, 'Inputs');
    row?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(rig.test.markRequests).toEqual([{ objects: [rig.scene.button], shouldFrame: true }]);
  });

  it('says so when no output reaches the edited object', () => {
    rig = inputsTabRigCreate();
    rig.tab.refresh([rig.scene.button]);
    expect(logicTestTableRowsRead(rig.test.context.container, 'Inputs')).toHaveLength(0);
    expect(rig.test.context.container.textContent).toContain('No output targets this object.');
  });
});
