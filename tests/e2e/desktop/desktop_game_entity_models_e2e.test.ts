import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as THREE from 'three';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import type { EditorApiGameEntityModelReport } from '@/ai/client/editor_api_game_entity_model.js';
import {
  e2eRequiredConfigurationAssert,
  e2eWindowsShownRead,
  previewE2eEnvironmentRead,
} from '../preview_e2e_environment.js';
import { previewE2eProjectRemove } from '../preview_e2e_game_process.js';
import { gameEntityModelTestGlbCreate } from '../../game_entity/model/game_entity_model_test_files.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';
import { desktopE2eProjectPrepare, type DesktopE2eProject } from './desktop_e2e_project_files.js';

/**
 * End-to-end acceptance of game entity models: the built desktop app opens a
 * temporary copy of the game project whose class file declares a prop class
 * picking its marker box, and the model that box names, by a field. A prop
 * placed over MCP draws the model the desktop app read from the project's asset
 * root, at the size it was written; a prop whose model file is missing reports
 * why. Needs BROOM_E2E_DESKTOP_EXE, BROOM_E2E_PREVIEW_EXE and
 * BROOM_E2E_PROJECT_DIR.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_GAME_ENTITY_MODELS_MCP_PORT'] ?? '19205');
const environment = previewE2eEnvironmentRead(32);
const isConfigured = desktopExecutable !== '' && environment.isConfigured;
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** Class file path relative to the project file. */
const CLASS_FILE = 'broom/entity_classes.json';

/** Type path of the prop class the class file declares. */
const PROP_CLASS_TYPE_PATH = 'e2e_game::level::StoreProp';

/** Model path of the crate prop, relative to the asset root. */
const CRATE_MODEL_PATH = 'e2e_models/props/crate.glb';

/** Model path of a prop whose file is never written. */
const MISSING_MODEL_PATH = 'e2e_models/props/missing.glb';

/** Edge lengths of the crate model. */
const CRATE_MODEL_SIZE = new THREE.Vector3(1.25, 0.75, 0.5);

/**
 * Returns the data of a tool result as a given shape.
 *
 * @param result Successful tool result.
 * @returns The result data.
 */
function toolDataRead<Data>(result: McpToolResult): Data {
  return result.data as Data;
}

/**
 * Returns the prop class: a fixture field picking a marker box, each box naming
 * a model.
 *
 * @returns Class as the class file declares it.
 */
function propClassCreate(): Record<string, unknown> {
  const boxOf = (model: string): Record<string, unknown> => ({
    size: CRATE_MODEL_SIZE.toArray(),
    offset: [0, CRATE_MODEL_SIZE.y / 2, 0],
    model,
  });
  return {
    type_path: PROP_CLASS_TYPE_PATH,
    label: 'E2E Store Prop',
    category: 'E2E',
    placement: 'point',
    fields: [{ path: 'fixture', label: 'Fixture', kind: 'text', default: 'crate' }],
    marker_box_field: 'fixture',
    marker_boxes: { crate: boxOf(CRATE_MODEL_PATH), ghost: boxOf(MISSING_MODEL_PATH) },
  };
}

/**
 * Rewrites the prepared project: no preview section, the class file with the
 * prop class, and the crate model under the asset root.
 *
 * @param project Prepared project.
 */
async function projectPropsWrite(project: DesktopE2eProject): Promise<void> {
  const definition = JSON.parse(readFileSync(project.projectFile, 'utf8')) as Record<string, unknown>;
  delete definition['preview'];
  definition['entity_classes'] = CLASS_FILE;
  writeFileSync(project.projectFile, JSON.stringify(definition, null, 2));
  const classFile = join(project.directory, CLASS_FILE);
  mkdirSync(dirname(classFile), { recursive: true });
  writeFileSync(classFile, JSON.stringify({ classes: [propClassCreate()], asset_types: [] }));
  const modelFile = join(project.directory, String(definition['asset_root'] ?? '.'), CRATE_MODEL_PATH);
  mkdirSync(dirname(modelFile), { recursive: true });
  writeFileSync(modelFile, new Uint8Array(await gameEntityModelTestGlbCreate(CRATE_MODEL_SIZE)));
}

describe.skipIf(!isConfigured)('desktop app game entity models end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  let client: DesktopE2eMcpClient;
  let project: DesktopE2eProject;

  /**
   * Places a prop through MCP once the prop class is known.
   *
   * @param fixture Fixture field value.
   * @returns Id of the placed prop.
   */
  async function propAdd(fixture: string): Promise<string> {
    await desktopE2eWaitUntil(
      'the prop class to be known',
      async () => {
        const listed = toolDataRead<{ classes: { type_path: string }[] }>(
          await client.toolCallExpectOk('list_game_classes'),
        );
        return listed.classes.some((entry) => entry.type_path === PROP_CLASS_TYPE_PATH) ? true : null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
    const added = await client.toolCallExpectOk('add_game_entity', {
      class: PROP_CLASS_TYPE_PATH,
      fields: { fixture },
    });
    return added.createdIds?.[0] ?? '';
  }

  /**
   * Waits until a prop's model report satisfies a condition.
   *
   * @param id Prop id.
   * @param description What is waited for.
   * @param isReady Condition on the report.
   * @returns The report that satisfied it.
   */
  async function modelReportWait(
    id: string,
    description: string,
    isReady: (report: EditorApiGameEntityModelReport) => boolean,
  ): Promise<EditorApiGameEntityModelReport> {
    return desktopE2eWaitUntil(
      description,
      async () => {
        const report = toolDataRead<EditorApiGameEntityModelReport>(
          await client.toolCallExpectOk('read_game_entity_model', { id }),
        );
        return isReady(report) ? report : null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  beforeAll(async () => {
    project = desktopE2eProjectPrepare({
      sourceProjectDirectory: environment.sourceProjectDirectory,
      previewExecutable: environment.previewExecutable,
      projectIdentifier: `models-e2e-${Math.random().toString(36).slice(2, 8)}`,
      bridgePort: environment.bridgePort,
      isWindowShown: e2eWindowsShownRead(),
    });
    await projectPropsWrite(project);
    app.start();
    client = new DesktopE2eMcpClient(await app.mcpUrlWait(LAUNCH_TIMEOUT_MILLISECONDS));
    await client.initialize();
    await desktopE2eWaitUntil(
      'the editor to answer tools',
      async () => ((await client.toolCall('get_editor_context')).ok ? true : null),
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
    await client.toolCallExpectOk('project_open', { path: project.projectFile });
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
    if (project) {
      previewE2eProjectRemove(project.directory);
    }
  });

  it(
    "draws a placed prop's model read from the project's asset root at the size it was written",
    async () => {
      const id = await propAdd('crate');
      const report = await modelReportWait(id, 'the crate model to be drawn', (candidate) => candidate.isDrawn);
      expect(report.model).toBe(CRATE_MODEL_PATH);
      expect(new THREE.Vector3(...(report.size ?? [0, 0, 0])).distanceTo(CRATE_MODEL_SIZE)).toBeLessThan(1e-4);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'reports why a model that is not in the project cannot be drawn',
    async () => {
      const id = await propAdd('ghost');
      const report = await modelReportWait(id, 'the missing model to fail', (candidate) => candidate.failure !== null);
      expect(report.isDrawn).toBe(false);
      expect(report.failure).toContain(MISSING_MODEL_PATH);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
