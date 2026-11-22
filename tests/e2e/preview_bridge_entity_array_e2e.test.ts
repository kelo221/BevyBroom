import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { EntityArrayCopyMark } from '@/entity_array/model/entity_array_copy_mark.js';
import { EntityArrayFollower } from '@/entity_array/sync/entity_array_follower.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from '../ai/client/editor_api_test_host.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PREVIEW_E2E_POSITION_TOLERANCE, PreviewE2eRig } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { previewE2eEntityRowsQuery } from './preview_e2e_game_query.js';
import { PREVIEW_E2E_DOOR_COMPONENT, PREVIEW_E2E_GAME_ENTITY_COMPONENT } from './preview_e2e_game_components.js';

/**
 * End-to-end acceptance of entity arrays: a game entity made to repeat through
 * the editor's MCP tools shows up in the game as one entity per copy, each where
 * the editor draws it and with the source's component values; changing the
 * count, the source or baking the copies is followed by the game. Skipped
 * unless BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR are set; its game
 * listens 33 ports above BROOM_E2E_PORT.
 */
const environment = previewE2eEnvironmentRead(33);
const STEP_TIMEOUT_MILLISECONDS = 60000;
const TRANSFORM_COMPONENT = 'bevy_transform::components::transform::Transform';

/** One game entity that carries the door component, as the game reports it. */
interface GameDoorRow {
  readonly id: string;
  readonly translation: THREE.Vector3;
  readonly door: Record<string, unknown>;
}

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

/**
 * Reads the editor id a game entity marker carries.
 *
 * @param marker Serialized marker component.
 * @returns The id, or an empty string.
 */
function markerIdRead(marker: unknown): string {
  if (typeof marker === 'string') {
    return marker;
  }
  if (Array.isArray(marker) && typeof marker[0] === 'string') {
    return marker[0];
  }
  const id = (marker as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : '';
}

describe.skipIf(!environment.isConfigured)('entity arrays in the game preview end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let parts: EditorApiTestHostParts;
  let api: EditorApi;
  let rig: PreviewE2eRig;
  let sourceId = '';

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
    new EntityArrayFollower(parts.world).follow(parts.commandStack);
    api = new EditorApi(parts.host);
    documentIdentityEnsure(parts.world);
    rig = new PreviewE2eRig(parts.world, environment.endpoint, 'entity_array_level');
  });

  afterAll(async () => {
    rig?.controller.disconnect();
    await game?.stop();
    if (projectDirectory !== '') {
      previewE2eProjectRemove(projectDirectory);
    }
  });

  /**
   * Reads every door the game spawned for the editor.
   *
   * @returns Door rows with their editor ids and translations.
   */
  async function gameDoorsRead(): Promise<GameDoorRow[]> {
    const rows = await previewE2eEntityRowsQuery(rig.transport, [
      PREVIEW_E2E_GAME_ENTITY_COMPONENT,
      PREVIEW_E2E_DOOR_COMPONENT,
      TRANSFORM_COMPONENT,
    ]);
    return rows.map((row) => {
      const transform = row.components[TRANSFORM_COMPONENT] as { translation?: number[] } | undefined;
      const translation = transform?.translation ?? [Number.NaN, Number.NaN, Number.NaN];
      return {
        id: markerIdRead(row.components[PREVIEW_E2E_GAME_ENTITY_COMPONENT]),
        translation: new THREE.Vector3(translation[0], translation[1], translation[2]),
        door: row.components[PREVIEW_E2E_DOOR_COMPONENT] as Record<string, unknown>,
      };
    });
  }

  /**
   * Returns the editor entities that should be doors in the game: the source
   * and every copy or baked copy, with their world positions.
   *
   * @param ids Editor ids.
   * @returns World positions by id.
   */
  function editorPositionsOf(ids: readonly string[]): Map<string, THREE.Vector3> {
    parts.world.updateWorldMatrix(true, true);
    return new Map(
      ids.map((id) => {
        const object = parts.world.getObjectByProperty('uuid', id);
        return [id, object?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(Number.NaN, 0, 0)];
      }),
    );
  }

  /**
   * Keeps the editor link updating until the game holds exactly the given
   * doors, each where the editor draws it and passing a check.
   *
   * @param description What is waited for.
   * @param ids Editor ids of the doors.
   * @param doorCheck Check on each serialized door.
   * @returns The matching doors.
   */
  async function gameDoorsUntil(
    description: string,
    ids: readonly string[],
    doorCheck: (door: Record<string, unknown>) => boolean = () => true,
  ): Promise<GameDoorRow[]> {
    const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
    while (performance.now() < end) {
      await rig.run(250);
      const doors = await gameDoorsRead().catch(() => [] as GameDoorRow[]);
      const expected = editorPositionsOf(ids);
      const isMatch =
        doors.length === ids.length &&
        doors.every((door) => {
          const position = expected.get(door.id);
          return position !== undefined && position.distanceTo(door.translation) < PREVIEW_E2E_POSITION_TOLERANCE;
        }) &&
        doors.every((door) => doorCheck(door.door));
      if (isMatch) {
        return doors;
      }
    }
    throw new Error(`Timed out waiting for ${description}; link error: ${rig.controller.lastErrorRead()}`);
  }

  /**
   * Returns the ids of the source's current copies.
   *
   * @returns Copy ids in child order.
   */
  function copyIdsRead(): string[] {
    const source = parts.world.getObjectByProperty('uuid', sourceId);
    return source === undefined ? [] : EntityArrayCopyMark.copiesOf(source).map((copy) => copy.uuid);
  }

  it(
    'spawns one game entity per copy where the editor draws it',
    async () => {
      await rig.until(
        'the game classes',
        (view) => rig.isCaughtUp(view) && GameEntityClassRegistry.classFind(PREVIEW_E2E_DOOR_COMPONENT) !== null,
        STEP_TIMEOUT_MILLISECONDS,
      );
      sourceId = toolData<{ id: string }>(
        api.invokeTool('add_game_entity', {
          class: PREVIEW_E2E_DOOR_COMPONENT,
          position: { x: 2, y: 0, z: -3 },
          rotationDegrees: { x: 0, y: 30, z: 0 },
        }),
      ).id;
      const result = toolData<{ copyIds: string[] }>(
        api.invokeTool('set_entity_array', { id: sourceId, array: { count_x: 3, count_z: 2, gap: [0.5, 0, 1] } }),
      );
      expect(result.copyIds).toHaveLength(3 * 2 - 1);
      await gameDoorsUntil('a door per copy', [sourceId, ...result.copyIds]);
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'gives every copy the values of the source and follows a smaller count',
    async () => {
      const speedField = GameEntityClassRegistry.classFind(PREVIEW_E2E_DOOR_COMPONENT)?.fields.find(
        (field) => field.path === 'speed',
      );
      const speed = (typeof speedField?.default === 'number' ? speedField.default : 0) + 2.5;
      toolData(
        api.invokeTool('set_game_components', {
          id: sourceId,
          components: { [PREVIEW_E2E_DOOR_COMPONENT]: { speed } },
        }),
      );
      await gameDoorsUntil(
        'copies with the new speed',
        [sourceId, ...copyIdsRead()],
        (door) => typeof door['speed'] === 'number' && Math.abs(door['speed'] - speed) < 1e-4,
      );
      toolData(api.invokeTool('set_entity_array', { id: sourceId, array: { count_x: 2, count_z: 1 } }));
      expect(copyIdsRead()).toHaveLength(1);
      await gameDoorsUntil('one copy left', [sourceId, ...copyIdsRead()]);
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'keeps the baked copies in the game where they stood',
    async () => {
      const bakedIds = toolData<{ bakedIds: string[] }>(api.invokeTool('bake_entity_array', { id: sourceId })).bakedIds;
      expect(bakedIds).toHaveLength(1);
      bakedIds.forEach((id) => expect(parts.world.getObjectByProperty('uuid', id)?.parent).toBe(parts.world));
      await gameDoorsUntil('the baked door beside the source', [sourceId, ...bakedIds]);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
