import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import type { PreviewBridgeStatus } from '@/preview/protocol/preview_protocol_types.js';
import type { GameProcessPhase, GameProcessStatus } from '@/project/process/game_process_types.js';
import {
  e2eRequiredConfigurationAssert,
  e2eWindowsShownRead,
  previewE2eEnvironmentRead,
} from '../preview_e2e_environment.js';
import { previewE2eProjectRemove } from '../preview_e2e_game_process.js';
import { previewE2eEntityRowsQuery } from '../preview_e2e_game_query.js';
import { PREVIEW_E2E_GAME_ENTITY_COMPONENT } from '../preview_e2e_game_components.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';
import { desktopE2eProjectPrepare, type DesktopE2eProject } from './desktop_e2e_project_files.js';

/**
 * End-to-end acceptance of the Entity Sprinkle tool: the built desktop app
 * opens a temporary copy of the game project whose sprinkle_directories hold a
 * definition naming a class the running game reported, lists it as a sprinkle
 * type, stamps entities of that class onto a floor brush, erases them with a
 * Subtractive stamp and restores them with undo, while the game shows exactly
 * the entities the editor holds. Needs BROOM_E2E_DESKTOP_EXE,
 * BROOM_E2E_PREVIEW_EXE, BROOM_E2E_PROJECT_DIR and cargo on the PATH.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const isCargoAvailable = spawnSync('cargo', ['--version'], { stdio: 'ignore' }).status === 0;
const mcpBasePort = Number(process.env['BROOM_E2E_SPRINKLE_MCP_PORT'] ?? '19045');
const environment = previewE2eEnvironmentRead(24);
const isConfigured = desktopExecutable !== '' && environment.isConfigured && isCargoAvailable;
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const BUILD_TIMEOUT_MILLISECONDS = 180000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** Sprinkle directory the test adds, relative to the asset root. */
const SPRINKLE_E2E_DIRECTORY = 'sprinkle';

/** Side length of the square floor brush the stamps land on. */
const SPRINKLE_E2E_FLOOR_SIZE = 12;

/** Thickness of the floor brush. */
const SPRINKLE_E2E_FLOOR_THICKNESS = 1;

/** Grid cell size the definition names. */
const SPRINKLE_E2E_GRID_SIZE = 1;

/** Brush radius of every stamp, a few grid cells wide and well inside the floor. */
const SPRINKLE_E2E_RADIUS = SPRINKLE_E2E_GRID_SIZE * 2.5;

/** Project status returned by the project tools. */
type SprinkleE2eProjectStatus = GameProcessStatus & { canManageGames: boolean };

/** Game preview view returned by the preview_status tool. */
interface SprinkleE2ePreviewStatus {
  connection: string;
  revisions: { state: number; geometry: number } | null;
  game: PreviewBridgeStatus | null;
}

/** One entry of a sprinkle_definitions_list reply. */
interface SprinkleE2eDefinitionSummary {
  name: string;
  sourcePath: string;
  grid: { sizeU: number; sizeV: number } | null;
  caseCount: number;
}

/** Data of a sprinkle_stamp reply. */
interface SprinkleE2eStampResult {
  added: number;
  removed: number;
}

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
 * Adds the test sprinkle directory to the project's sprinkle directories.
 *
 * @param project Prepared project.
 */
function projectSprinkleDirectoryAdd(project: DesktopE2eProject): void {
  const definition = JSON.parse(readFileSync(project.projectFile, 'utf8')) as Record<string, unknown>;
  definition['sprinkle_directories'] = [SPRINKLE_E2E_DIRECTORY];
  writeFileSync(project.projectFile, JSON.stringify(definition, null, 2));
}

/**
 * Reads the asset root of a prepared project from its project file.
 *
 * @param project Prepared project.
 * @returns Absolute asset root.
 */
function projectAssetRootRead(project: DesktopE2eProject): string {
  const definition = JSON.parse(readFileSync(project.projectFile, 'utf8')) as { asset_root: string };
  return join(project.directory, definition.asset_root);
}

/**
 * Builds the text of a sprinkle definition file with one type placing one class
 * on a square grid.
 *
 * @param typeName Sprinkle type name.
 * @param className Game class type path the type places.
 * @returns KeyValues text.
 */
function sprinkleDefinitionTextBuild(typeName: string, className: string): string {
  const grid = `${SPRINKLE_E2E_GRID_SIZE} ${SPRINKLE_E2E_GRID_SIZE}`;
  return [`"${typeName}"`, '{', `  base { classname "${className}" grid "${grid}" }`, '  1 { }', '}', ''].join('\n');
}

/**
 * Writes a sprinkle definition file into the test sprinkle directory.
 *
 * @param assetRoot Absolute asset root.
 * @param fileName File name inside the sprinkle directory.
 * @param text File text.
 */
function sprinkleDefinitionWrite(assetRoot: string, fileName: string, text: string): void {
  const directory = join(assetRoot, SPRINKLE_E2E_DIRECTORY);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, fileName), text);
}

/**
 * Returns the game class the test sprinkles: the first class reported for point
 * placement, or the first class when none is.
 *
 * @param classes Classes the game reported.
 * @returns Chosen class, or null without classes.
 */
function sprinkleClassChoose(classes: readonly GameEntityClass[]): GameEntityClass | null {
  return classes.find((gameClass) => gameClass.placement === 'point') ?? classes[0] ?? null;
}

describe.skipIf(!isConfigured)('desktop app Entity Sprinkle end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  const transport = new PreviewLinkTransportHttp(environment.endpoint);
  const typeName = `E2E Sprinkle ${Math.random().toString(36).slice(2, 8)}`;
  let client: DesktopE2eMcpClient;
  let project: DesktopE2eProject;
  let sprinkledClass: GameEntityClass | null = null;
  let instanceIdentifier = '';
  let baselineCount = 0;
  let stampedCount = 0;

  /**
   * Waits until the managed game reaches a phase.
   *
   * @param phase Awaited phase.
   * @returns The matching status.
   */
  async function phaseWait(phase: GameProcessPhase): Promise<SprinkleE2eProjectStatus> {
    return desktopE2eWaitUntil(
      `the game to reach ${phase}`,
      async () => {
        const status = toolDataRead<SprinkleE2eProjectStatus>(await client.toolCallExpectOk('project_status'));
        return status.phase === phase ? status : null;
      },
      BUILD_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Returns whether a preview status shows a connected game of a newer instance
   * that applied everything the editor sent.
   *
   * @param status Preview status.
   * @param previousInstanceIdentifier Instance that must have been replaced.
   * @returns True when the game is new and caught up.
   */
  function gameIsNewAndCaughtUp(status: SprinkleE2ePreviewStatus, previousInstanceIdentifier: string): boolean {
    const game = status.game;
    const isNewGame =
      game !== null && game.project_id === project.projectIdentifier && game.instance_id !== previousInstanceIdentifier;
    const isCaughtUp = isNewGame && status.revisions !== null && game.state_revision_applied === status.revisions.state;
    return status.connection === 'connected' && isCaughtUp;
  }

  /**
   * Launches the game and waits until a new game instance applied the document.
   *
   * @returns Instance id of the new game.
   */
  async function gameLaunchAndCatchUp(): Promise<string> {
    const previousInstanceIdentifier = instanceIdentifier;
    await client.toolCallExpectOk('game_launch');
    await phaseWait('running');
    const status = await desktopE2eWaitUntil(
      'a new game to apply the document',
      async () => {
        const preview = toolDataRead<SprinkleE2ePreviewStatus>(await client.toolCallExpectOk('preview_status'));
        return gameIsNewAndCaughtUp(preview, previousInstanceIdentifier) ? preview : null;
      },
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
    return status.game?.instance_id ?? '';
  }

  /**
   * Waits until the editor knows the classes the game reported.
   *
   * @returns The reported classes.
   */
  async function gameClassesWait(): Promise<GameEntityClass[]> {
    return desktopE2eWaitUntil(
      'the game classes to reach the editor',
      async () => {
        const listed = toolDataRead<{ classes: GameEntityClass[] }>(await client.toolCallExpectOk('list_game_classes'));
        return listed.classes.length > 0 ? listed.classes : null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Returns the type path of the sprinkled class.
   *
   * @returns Type path.
   */
  function sprinkledTypePathRead(): string {
    if (!sprinkledClass) {
      throw new Error('the game reported no class to sprinkle');
    }
    return sprinkledClass.type_path;
  }

  /**
   * Counts the authored game entities of the sprinkled class in the game.
   *
   * @returns Entity count.
   */
  async function gameSprinkledClassCount(): Promise<number> {
    const rows = await previewE2eEntityRowsQuery(transport, [
      sprinkledTypePathRead(),
      PREVIEW_E2E_GAME_ENTITY_COMPONENT,
    ]);
    return rows.length;
  }

  /**
   * Waits until the game shows a number of authored entities of the sprinkled
   * class.
   *
   * @param expectedCount Awaited entity count.
   * @param description What the count means, used in the timeout error.
   */
  async function gameSprinkledClassCountWait(expectedCount: number, description: string): Promise<void> {
    await desktopE2eWaitUntil(
      `the game to show ${expectedCount} entities: ${description}`,
      async () => ((await gameSprinkledClassCount()) === expectedCount ? true : null),
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Builds a flat floor brush whose top face is centered on the world origin
   * and removes the unit box the new solid model starts with.
   */
  async function floorBuild(): Promise<void> {
    const created = await client.toolCallExpectOk('create_solid_model', { name: 'SprinkleFloor' });
    const { modelId, brushId } = toolDataRead<{ modelId: string; brushId: string }>(created);
    await client.toolCallExpectOk('add_box_brush', {
      modelId,
      size: { x: SPRINKLE_E2E_FLOOR_SIZE, y: SPRINKLE_E2E_FLOOR_THICKNESS, z: SPRINKLE_E2E_FLOOR_SIZE },
      position: { x: 0, y: -SPRINKLE_E2E_FLOOR_THICKNESS / 2, z: 0 },
      snap: false,
    });
    await client.toolCallExpectOk('delete_brushes', { brushIds: [brushId] });
  }

  /**
   * Stamps the test type at the floor center.
   *
   * @param mode Placement mode of the stamp.
   * @returns Entities added and removed.
   */
  async function stamp(mode: string): Promise<SprinkleE2eStampResult> {
    const stamped = await client.toolCallExpectOk('sprinkle_stamp', {
      definition: typeName,
      center: { x: 0, y: 0, z: 0 },
      mode,
      radius: SPRINKLE_E2E_RADIUS,
      densityPercent: 100,
    });
    return toolDataRead<SprinkleE2eStampResult>(stamped);
  }

  beforeAll(async () => {
    project = desktopE2eProjectPrepare({
      sourceProjectDirectory: environment.sourceProjectDirectory,
      previewExecutable: environment.previewExecutable,
      projectIdentifier: `sprinkle-e2e-${Math.random().toString(36).slice(2, 8)}`,
      bridgePort: environment.bridgePort,
      isWindowShown: e2eWindowsShownRead(),
    });
    projectSprinkleDirectoryAdd(project);
    app.start();
    client = new DesktopE2eMcpClient(await app.mcpUrlWait(LAUNCH_TIMEOUT_MILLISECONDS));
    await client.initialize();
    await desktopE2eWaitUntil(
      'the editor to answer tools',
      async () => ((await client.toolCall('get_editor_context')).ok ? true : null),
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await client?.toolCall('game_stop').catch(() => undefined);
    await phaseWait('stopped').catch(() => undefined);
    await app.stop();
    if (project) {
      previewE2eProjectRemove(project.directory);
    }
  });

  it(
    'learns a class from the running game and writes a sprinkle definition placing it',
    async () => {
      await client.toolCallExpectOk('project_open', { path: project.projectFile });
      instanceIdentifier = await gameLaunchAndCatchUp();
      sprinkledClass = sprinkleClassChoose(await gameClassesWait());
      expect(sprinkledClass).not.toBeNull();
      sprinkleDefinitionWrite(
        projectAssetRootRead(project),
        'e2e_sprinkle.txt',
        sprinkleDefinitionTextBuild(typeName, sprinkledTypePathRead()),
      );
      await client.toolCallExpectOk('game_stop');
      await phaseWait('stopped');
    },
    BUILD_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'lists the definition as a sprinkle type once the project opens again',
    async () => {
      await client.toolCallExpectOk('project_open', { path: project.projectFile });
      const listed = await desktopE2eWaitUntil(
        `the sprinkle type ${typeName} to be listed`,
        async () => {
          const reply = toolDataRead<{ definitions: SprinkleE2eDefinitionSummary[] }>(
            await client.toolCallExpectOk('sprinkle_definitions_list'),
          );
          return reply.definitions.find((definition) => definition.name === typeName) ?? null;
        },
        STEP_TIMEOUT_MILLISECONDS,
      );
      expect(listed.sourcePath).toBe(`${SPRINKLE_E2E_DIRECTORY}/e2e_sprinkle.txt`);
      expect(listed.grid).toEqual({ sizeU: SPRINKLE_E2E_GRID_SIZE, sizeV: SPRINKLE_E2E_GRID_SIZE });
      expect(listed.caseCount).toBe(1);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'stamps entities of the class onto a floor that the running game shows',
    async () => {
      instanceIdentifier = await gameLaunchAndCatchUp();
      await gameClassesWait();
      await floorBuild();
      baselineCount = await desktopE2eWaitUntil(
        'the game to answer entity queries',
        async () => gameSprinkledClassCount(),
        STEP_TIMEOUT_MILLISECONDS,
      );
      const added = await stamp('ADDITIVE');
      expect(added.removed).toBe(0);
      expect(added.added).toBeGreaterThan(0);
      stampedCount = added.added;
      await gameSprinkledClassCountWait(baselineCount + stampedCount, 'the stamped entities');
    },
    BUILD_TIMEOUT_MILLISECONDS + STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'erases the stamped entities with a Subtractive stamp and brings them back with undo',
    async () => {
      const erased = await stamp('SUBTRACTIVE');
      expect(erased).toEqual({ added: 0, removed: stampedCount });
      await gameSprinkledClassCountWait(baselineCount, 'after the Subtractive stamp');
      await client.toolCallExpectOk('undo');
      await gameSprinkledClassCountWait(baselineCount + stampedCount, 'after undoing the Subtractive stamp');
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );
});
