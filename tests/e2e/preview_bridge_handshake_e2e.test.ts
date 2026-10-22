import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import { PREVIEW_PROTOCOL_VERSION } from '@/preview/protocol/preview_protocol_types.js';
import {
  PREVIEW_E2E_PROJECT_FILE_NAME,
  PreviewE2eGameProcess,
  previewE2eProjectCopy,
  previewE2eProjectRemove,
} from './preview_e2e_game_process.js';
import { PreviewE2eRig } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { previewE2eGameMaterialBoxCreate } from './preview_e2e_scene_parts.js';

/**
 * End-to-end acceptance of the handshake: the editor publishes nothing into a
 * game that speaks another protocol or belongs to another project, explains
 * why, and publishes normally into a matching game. Skipped unless
 * BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR are set; its games listen
 * eight and nine ports above BROOM_E2E_PORT.
 */
const mismatchEnvironment = previewE2eEnvironmentRead(8);
const matchingEnvironment = previewE2eEnvironmentRead(9);
const STEP_TIMEOUT_MILLISECONDS = 60000;
const LINK_WAIT_MILLISECONDS = 1500;

/**
 * Reads the project id of a project directory.
 *
 * @param projectDirectory Directory holding broom.project.json.
 * @returns Project id.
 */
function projectIdentifierRead(projectDirectory: string): string {
  const project = JSON.parse(readFileSync(join(projectDirectory, PREVIEW_E2E_PROJECT_FILE_NAME), 'utf8')) as {
    project_id: string;
  };
  return project.project_id;
}

/**
 * Builds an editor world with one game-material box and a document identity.
 *
 * @returns Editor world.
 */
function worldWithBoxCreate(): THREE.Group {
  const world = new THREE.Group();
  world.add(
    previewE2eGameMaterialBoxCreate(
      'Handshake Box',
      'stone/castle_wall',
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(1, 1, 1),
    ),
  );
  documentIdentityEnsure(world);
  return world;
}

/**
 * Starts a game in a fresh project copy.
 *
 * @param environment Environment of the game's port.
 * @param extraArguments More command line arguments.
 * @returns The game and its project directory.
 */
function gameInProjectCopyStart(
  environment: ReturnType<typeof previewE2eEnvironmentRead>,
  extraArguments: readonly string[],
): { game: PreviewE2eGameProcess; projectDirectory: string } {
  const projectDirectory = previewE2eProjectCopy(environment.sourceProjectDirectory);
  const game = new PreviewE2eGameProcess(
    environment.previewExecutable,
    projectDirectory,
    environment.bridgePort,
    e2eWindowsShownRead(),
    extraArguments,
  );
  game.start();
  return { game, projectDirectory };
}

describe.skipIf(!mismatchEnvironment.isConfigured)('preview handshake end to end', () => {
  let mismatched: { game: PreviewE2eGameProcess; projectDirectory: string };
  let matching: { game: PreviewE2eGameProcess; projectDirectory: string };
  const rigs: PreviewE2eRig[] = [];

  beforeAll(() => {
    mismatched = gameInProjectCopyStart(mismatchEnvironment, [
      '--protocol-override',
      String(PREVIEW_PROTOCOL_VERSION + 1),
    ]);
    matching = gameInProjectCopyStart(matchingEnvironment, []);
  });

  afterAll(async () => {
    rigs.forEach((rig) => rig.controller.disconnect());
    for (const started of [mismatched, matching]) {
      await started?.game.stop();
      if (started) {
        previewE2eProjectRemove(started.projectDirectory);
      }
    }
  });

  it(
    'refuses a game of another protocol before publishing anything',
    async () => {
      const rig = new PreviewE2eRig(worldWithBoxCreate(), mismatchEnvironment.endpoint, 'handshake_level');
      rigs.push(rig);
      await rig.untilLink(
        'the incompatible verdict',
        (link) => link.connectionStateRead() === 'incompatible',
        STEP_TIMEOUT_MILLISECONDS,
      );
      await rig.run(LINK_WAIT_MILLISECONDS);
      const view = await rig.gameViewRead();
      expect(rig.controller.lastErrorRead()).toContain(String(PREVIEW_PROTOCOL_VERSION + 1));
      expect(view.status.state_revision_received).toBe(0);
      expect(view.status.geometry_revision_received).toBe(0);
      rig.controller.disconnect();
    },
    STEP_TIMEOUT_MILLISECONDS + LINK_WAIT_MILLISECONDS * 4,
  );

  it(
    'refuses a game of another project, then publishes into the game of its own project',
    async () => {
      const projectIdentifier = projectIdentifierRead(matching.projectDirectory);
      const wrongProject = new PreviewE2eRig(worldWithBoxCreate(), matchingEnvironment.endpoint, 'handshake_level');
      rigs.push(wrongProject);
      wrongProject.expectedProjectIdentifier = `${projectIdentifier}-elsewhere`;
      await wrongProject.untilLink(
        'the project mismatch',
        (link) => link.connectionStateRead() === 'incompatible',
        STEP_TIMEOUT_MILLISECONDS,
      );
      expect(wrongProject.controller.lastErrorRead()).toContain(projectIdentifier);
      expect((await wrongProject.gameViewRead()).status.state_revision_received).toBe(0);
      wrongProject.controller.disconnect();
      const rightProject = new PreviewE2eRig(worldWithBoxCreate(), matchingEnvironment.endpoint, 'handshake_level');
      rigs.push(rightProject);
      rightProject.expectedProjectIdentifier = projectIdentifier;
      const view = await rightProject.until(
        'the scene to arrive',
        (gameView) => rightProject.isCaughtUp(gameView),
        STEP_TIMEOUT_MILLISECONDS,
      );
      expect(rightProject.controller.connectionStateRead()).toBe('connected');
      expect(view.status.project_id).toBe(projectIdentifier);
    },
    STEP_TIMEOUT_MILLISECONDS * 3,
  );
});
