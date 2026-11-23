import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import { PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH } from '@/procedural/export/procedural_export_component.js';
import {
  PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID,
  PROCEDURAL_PEOPLE_MOVER_BELT,
  PROCEDURAL_PEOPLE_MOVER_DIRECTION,
  PROCEDURAL_PEOPLE_MOVER_END,
  PROCEDURAL_PEOPLE_MOVER_SPEED,
  PROCEDURAL_PEOPLE_MOVER_START,
} from '@/procedural/generator/people_mover/procedural_generator_people_mover.js';
import {
  PROCEDURAL_PEOPLE_MOVER_DIRECTION_END_TO_START,
  PROCEDURAL_PEOPLE_MOVER_DIRECTION_START_TO_END,
} from '@/procedural/generator/people_mover/procedural_people_mover_travel.js';
import { PROCEDURAL_PEOPLE_MOVER_PART_CAR } from '@/procedural/generator/people_mover/procedural_people_mover_dimensions.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from '../ai/client/editor_api_test_host.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PreviewE2eRig } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { PREVIEW_E2E_NAME_COMPONENT, previewE2eEntityRowsQuery, previewE2eNameRead } from './preview_e2e_game_query.js';
import { PREVIEW_E2E_AUTHORED_NODE_COMPONENT, previewE2eObjectComponentRead } from './preview_e2e_game_components.js';

/**
 * End-to-end acceptance of the people mover: a travelator, an escalator and an
 * elevator placed through MCP each reach the game preview with the shape the
 * editor resolved, their direction and their belt speed signed toward the high
 * end, and the elevator's car arrives as its own named node the game can move.
 * Skipped unless BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR are set; its
 * game listens twenty-nine ports above BROOM_E2E_PORT.
 */
const environment = previewE2eEnvironmentRead(29);
const STEP_TIMEOUT_MILLISECONDS = 60000;

/**
 * One mover to place: its shape, ends, direction and speed, and the belt speed
 * signed toward the high end the game must receive.
 */
interface PeopleMoverE2eCase {
  readonly shape: string;
  readonly start: THREE.Vector3;
  readonly end: THREE.Vector3;
  readonly direction: string;
  readonly speed: number;
  readonly belt: number;
}

/**
 * A gentle, a steep and a vertical mover, far enough apart not to overlap; the
 * escalator carries people down from its high end.
 */
const PEOPLE_MOVER_E2E_CASES: readonly PeopleMoverE2eCase[] = [
  {
    shape: 'travelator',
    start: new THREE.Vector3(0, 0, 0),
    end: new THREE.Vector3(10, 1, 0),
    direction: PROCEDURAL_PEOPLE_MOVER_DIRECTION_START_TO_END,
    speed: 0.75,
    belt: 0.75,
  },
  {
    shape: 'escalator',
    start: new THREE.Vector3(0, 0, 10),
    end: new THREE.Vector3(6, 4, 10),
    direction: PROCEDURAL_PEOPLE_MOVER_DIRECTION_END_TO_START,
    speed: 0.5,
    belt: -0.5,
  },
  {
    shape: 'elevator',
    start: new THREE.Vector3(20, 0, 0),
    end: new THREE.Vector3(20, 8, 0),
    direction: PROCEDURAL_PEOPLE_MOVER_DIRECTION_START_TO_END,
    speed: 1.5,
    belt: 1.5,
  },
];

/**
 * Returns the data of a successful tool result.
 *
 * @param result Tool result.
 * @returns The result data.
 */
function toolData<Data>(result: McpToolResult): Data {
  if (!result.ok) {
    throw new Error(`tool failed: ${result.message}`);
  }
  return result.data as Data;
}

describe.skipIf(!environment.isConfigured)('people movers in the game preview end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let parts: EditorApiTestHostParts;
  let api: EditorApi;
  let rig: PreviewE2eRig;

  beforeAll(() => {
    projectDirectory = previewE2eProjectCopy(environment.sourceProjectDirectory);
    game = new PreviewE2eGameProcess(
      environment.previewExecutable,
      projectDirectory,
      environment.bridgePort,
      e2eWindowsShownRead(),
    );
    game.start();
    parts = editorApiTestHostCreate();
    api = new EditorApi(parts.host);
    documentIdentityEnsure(parts.world);
    rig = new PreviewE2eRig(parts.world, environment.endpoint, 'people_mover_level');
  });

  afterAll(async () => {
    rig?.controller.disconnect();
    await game?.stop();
    if (projectDirectory !== '') {
      previewE2eProjectRemove(projectDirectory);
    }
  });

  /**
   * Keeps the editor link updating until a check on the game passes.
   *
   * @param description What is waited for.
   * @param check Reads the game and returns a value when satisfied, else null.
   * @returns The value the check returned.
   */
  async function gameUntil<Value>(description: string, check: () => Promise<Value | null>): Promise<Value> {
    const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
    while (performance.now() < end) {
      await rig.run(250);
      const value = await check().catch(() => null);
      if (value !== null) {
        return value;
      }
    }
    throw new Error(`Timed out waiting for ${description}; link error: ${rig.controller.lastErrorRead()}`);
  }

  /**
   * Places a mover through MCP.
   *
   * @param moverCase Mover to place.
   * @returns Its object id.
   */
  function moverAdd(moverCase: PeopleMoverE2eCase): string {
    return toolData<{ id: string }>(
      api.invokeTool('add_procedural', {
        name: moverCase.shape,
        settings: {
          generatorId: PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID,
          parameters: {
            [PROCEDURAL_PEOPLE_MOVER_START]: moverCase.start.toArray(),
            [PROCEDURAL_PEOPLE_MOVER_END]: moverCase.end.toArray(),
            [PROCEDURAL_PEOPLE_MOVER_DIRECTION]: moverCase.direction,
            [PROCEDURAL_PEOPLE_MOVER_SPEED]: moverCase.speed,
          },
        },
      }),
    ).id;
  }

  /**
   * Waits until the game holds a mover's prop with its shape, direction and
   * signed belt speed.
   *
   * @param id Mover object id.
   * @param moverCase Placed mover.
   */
  async function moverPropWait(id: string, moverCase: PeopleMoverE2eCase): Promise<void> {
    await gameUntil(`the ${moverCase.shape} parameters`, async () => {
      const prop = await previewE2eObjectComponentRead(
        rig.transport,
        PREVIEW_E2E_AUTHORED_NODE_COMPONENT,
        id,
        PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH,
      );
      if (prop === null) {
        return null;
      }
      const derived = JSON.parse(String(prop['derived'])) as Record<string, unknown>;
      const parameters = JSON.parse(String(prop['parameters'])) as Record<string, unknown>;
      const isShapeSent = derived['shape'] === moverCase.shape;
      const isDirectionSent = parameters[PROCEDURAL_PEOPLE_MOVER_DIRECTION] === moverCase.direction;
      return isShapeSent && isDirectionSent && derived[PROCEDURAL_PEOPLE_MOVER_BELT] === moverCase.belt ? true : null;
    });
  }

  it(
    'shows a travelator, an escalator and an elevator with the shapes the editor resolved',
    async () => {
      const ids = PEOPLE_MOVER_E2E_CASES.map((moverCase) => moverAdd(moverCase));
      for (const [index, moverCase] of PEOPLE_MOVER_E2E_CASES.entries()) {
        await moverPropWait(ids[index] ?? '', moverCase);
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 3,
  );

  it(
    'gives the elevator car its own named node',
    async () => {
      const names = await gameUntil('the elevator car node', async () => {
        const rows = await previewE2eEntityRowsQuery(rig.transport, [PREVIEW_E2E_NAME_COMPONENT]);
        const rowNames = rows.map((row) => previewE2eNameRead(row.components[PREVIEW_E2E_NAME_COMPONENT]));
        return rowNames.includes(PROCEDURAL_PEOPLE_MOVER_PART_CAR) ? rowNames : null;
      });
      expect(names.filter((name) => name === PROCEDURAL_PEOPLE_MOVER_PART_CAR)).toHaveLength(1);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
