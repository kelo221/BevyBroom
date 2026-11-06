import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from '../ai/client/editor_api_test_host.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PreviewE2eRig, previewE2eSleep } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import {
  PREVIEW_E2E_DISPLACEMENT_SURFACE_COMPONENT,
  PREVIEW_E2E_NAME_COMPONENT,
  previewE2eEntityRowsQuery,
  previewE2eNameRead,
} from './preview_e2e_game_query.js';
import { displacementSurfaceMeshNameBuild } from '@/displacement/mesh/displacement_surface_mesh_keys.js';
import { DISPLACEMENT_EXPORT_COLLISION_EXTRAS_KEY } from '@/displacement/export/displacement_export_collision_extras.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { glbJsonRead } from '../io/glb/glb_json_read.js';

/**
 * End-to-end acceptance of displacements: `set_face_displacement` shows a
 * `displacement:<brushId>:<face>` mesh in the live game while the displaced
 * brush's own result mesh leaves the game, undo brings the result back and
 * removes the surface, redo restores the surface, collision flags set through
 * `set_face_displacement` appear on the surface as `BroomDisplacementSurface`
 * and leave it when cleared, and a shipped GLB carries only the surface under
 * the solid with its flags in `broom_displacement` extras. Skipped unless
 * BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR are set; its games listen
 * sixteen and seventeen ports above BROOM_E2E_PORT.
 */
const environment = previewE2eEnvironmentRead(16);
const shippedEnvironment = previewE2eEnvironmentRead(17);
const STEP_TIMEOUT_MILLISECONDS = 60000;
const SHIPPED_SCENE_PATH = 'shipped/displacement_level.glb';

/** Collision flags the game shows for flags set through `set_face_displacement`. */
type GameDisplacementFlags = Record<
  'no_physics_collision' | 'no_hull_collision' | 'no_ray_collision' | 'seals',
  boolean
>;

/** Flags the first flag step sets, in the editor's and in the game's names. */
const FIRST_FLAGS = { noPhysicsCollision: true, seals: true };
const FIRST_GAME_FLAGS: GameDisplacementFlags = {
  no_physics_collision: true,
  no_hull_collision: false,
  no_ray_collision: false,
  seals: true,
};

/** Flags the level is shipped with, in the editor's and in the game's names. */
const SHIPPED_FLAGS = { noHullCollision: true, noRayCollision: true };
const SHIPPED_GAME_FLAGS: GameDisplacementFlags = {
  no_physics_collision: false,
  no_hull_collision: true,
  no_ray_collision: true,
  seals: false,
};

/** Every flag off, in the editor's names. */
const CLEARED_FLAGS = { noPhysicsCollision: false, noHullCollision: false, noRayCollision: false, seals: false };

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

describe.skipIf(!environment.isConfigured)('displacements in the game preview end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let parts: EditorApiTestHostParts;
  let api: EditorApi;
  let rig: PreviewE2eRig;
  let brushId = '';
  let displacementName = '';
  let resultName = '';
  let solidName = '';
  let flatResultCount = 0;

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
    rig = new PreviewE2eRig(parts.world, environment.endpoint, 'displacement_level');
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
   * Counts the game entities carrying a Name.
   *
   * @param transport Transport to the game.
   * @param name Entity name.
   * @returns Number of entities with that Name.
   */
  async function namedCountRead(transport: PreviewLinkTransportHttp, name: string): Promise<number> {
    const rows = await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_NAME_COMPONENT]);
    return rows.filter((row) => previewE2eNameRead(row.components[PREVIEW_E2E_NAME_COMPONENT]) === name).length;
  }

  /**
   * Returns whether the game has a named displacement mesh.
   *
   * @param transport Transport to the game.
   * @param name Displacement mesh name.
   * @returns True when a Name matches.
   */
  async function displacementNamedIs(transport: PreviewLinkTransportHttp, name: string): Promise<boolean> {
    return (await namedCountRead(transport, name)) > 0;
  }

  /**
   * Returns whether the live game shows the displacement surface as wanted and
   * the displaced brush's result mesh only while the brush is flat.
   *
   * @param displaced True when the brush is expected to be displaced.
   * @returns True when both the surface and the result count match.
   */
  async function displacedStateShownIs(displaced: boolean): Promise<boolean> {
    const surfaceShown = await displacementNamedIs(rig.transport, displacementName);
    const resultCount = await namedCountRead(rig.transport, resultName);
    return surfaceShown === displaced && resultCount === (displaced ? flatResultCount - 1 : flatResultCount);
  }

  /**
   * Reads the collision flags the game shows on the named displacement surface.
   *
   * @param transport Transport to the game.
   * @param name Displacement mesh name.
   * @returns Null while the game has no entity of that name, otherwise the
   *   flags of the first named entity carrying them, or `absent` when none
   *   does.
   */
  async function surfaceFlagsRead(
    transport: PreviewLinkTransportHttp,
    name: string,
  ): Promise<GameDisplacementFlags | 'absent' | null> {
    const rows = await previewE2eEntityRowsQuery(
      transport,
      [PREVIEW_E2E_NAME_COMPONENT],
      [PREVIEW_E2E_DISPLACEMENT_SURFACE_COMPONENT],
    );
    const named = rows.filter((row) => previewE2eNameRead(row.components[PREVIEW_E2E_NAME_COMPONENT]) === name);
    if (named.length === 0) {
      return null;
    }
    const flagged = named.find((row) => row.has?.[PREVIEW_E2E_DISPLACEMENT_SURFACE_COMPONENT] === true);
    return flagged ? surfaceFlagsOfEntityRead(transport, flagged.entity) : 'absent';
  }

  /**
   * Reads the collision flags component of one game entity.
   *
   * @param transport Transport to the game.
   * @param entity Entity carrying the component.
   * @returns The component as the remote protocol serializes it.
   */
  async function surfaceFlagsOfEntityRead(
    transport: PreviewLinkTransportHttp,
    entity: number,
  ): Promise<GameDisplacementFlags> {
    const rows = await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_DISPLACEMENT_SURFACE_COMPONENT]);
    const row = rows.find((candidate) => candidate.entity === entity);
    return row?.components[PREVIEW_E2E_DISPLACEMENT_SURFACE_COMPONENT] as GameDisplacementFlags;
  }

  /**
   * Returns whether the game shows the named displacement surface with the
   * wanted flags, or without the flags component when none is wanted.
   *
   * @param transport Transport to the game.
   * @param wanted Wanted flags, or `absent` for no component.
   * @returns True when the surface shows exactly what is wanted.
   */
  async function surfaceFlagsShownIs(
    transport: PreviewLinkTransportHttp,
    wanted: GameDisplacementFlags | 'absent',
  ): Promise<boolean> {
    const shown = await surfaceFlagsRead(transport, displacementName);
    if (shown === null || shown === 'absent' || wanted === 'absent') {
      return shown === wanted;
    }
    return Object.entries(wanted).every(([flag, value]) => shown[flag as keyof GameDisplacementFlags] === value);
  }

  /**
   * Sets collision flags of the displaced face through the MCP tool.
   *
   * @param flags Flags to change, in the editor's names.
   */
  function surfaceFlagsSet(flags: Record<string, boolean>): void {
    toolData(api.invokeTool('set_face_displacement', { brushId, faceIndex: 0, action: 'set', flags }));
  }

  /**
   * Finds the solid model owning a brush in the editor world.
   *
   * @param ownedBrushId Brush id.
   * @returns Owning solid model.
   */
  function solidModelOfBrushRead(ownedBrushId: string): SolidModel {
    const owners: SolidModel[] = [];
    parts.world.traverse((object) => {
      const model = SolidModel.isSolidModelObject(object) ? SolidModel.fromObject(object) : null;
      if (model?.findBrush(ownedBrushId)) owners.push(model);
    });
    const owner = owners[0];
    if (!owner) throw new Error(`no solid model owns brush ${ownedBrushId}`);
    return owner;
  }

  /**
   * Lists the names of the child nodes of one named node in a GLB.
   *
   * @param buffer GLB bytes.
   * @param nodeName Parent node name.
   * @returns Child node names.
   */
  function glbChildNamesRead(buffer: ArrayBuffer, nodeName: string): string[] {
    const nodes = glbJsonRead(buffer).nodes ?? [];
    const parent = nodes.find((node) => node.name === nodeName);
    if (!parent) throw new Error(`GLB has no node ${nodeName}`);
    return (parent.children ?? []).map((childIndex) => nodes[childIndex]?.name ?? '');
  }

  it(
    'creates a solid and a power-2 displacement the game shows by name',
    async () => {
      await rig.until('the live game', (view) => rig.isCaughtUp(view), STEP_TIMEOUT_MILLISECONDS);
      const created = toolData<{ modelId: string; brushId: string }>(
        api.invokeTool('create_solid_model', { name: 'DisplacementPad' }),
      );
      brushId = created.brushId;
      displacementName = displacementSurfaceMeshNameBuild({ brushId, surfaceIndex: 0 });
      const model = solidModelOfBrushRead(brushId);
      resultName = model.getResultMesh().name;
      solidName = model.root.name;
      flatResultCount = await gameUntil('the flat solid result mesh', async () => {
        const count = await namedCountRead(rig.transport, resultName);
        return count > 0 ? count : null;
      });
      toolData(
        api.invokeTool('set_face_displacement', {
          brushId,
          faceIndex: 0,
          action: 'create',
          power: 2,
          elevation: 0.5,
        }),
      );
      await gameUntil('the displacement mesh without the brush result mesh', async () =>
        (await displacedStateShownIs(true)) ? true : null,
      );
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'removes the displacement on undo and restores it on redo',
    async () => {
      expect(parts.commandStack.undo()).toBe(true);
      await gameUntil('the flat result mesh instead of the displacement mesh', async () =>
        (await displacedStateShownIs(false)) ? true : null,
      );
      expect(parts.commandStack.redo()).toBe(true);
      await gameUntil('the displacement mesh without the result mesh after redo', async () =>
        (await displacedStateShownIs(true)) ? true : null,
      );
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'gives the displacement surface its collision flags in the live game and takes them away when cleared',
    async () => {
      surfaceFlagsSet(FIRST_FLAGS);
      await gameUntil('the displacement surface with the first collision flags', async () =>
        (await surfaceFlagsShownIs(rig.transport, FIRST_GAME_FLAGS)) ? true : null,
      );
      surfaceFlagsSet(CLEARED_FLAGS);
      await gameUntil('the displacement surface without collision flags', async () =>
        (await surfaceFlagsShownIs(rig.transport, 'absent')) ? true : null,
      );
      surfaceFlagsSet(SHIPPED_FLAGS);
      await gameUntil('the displacement surface with the shipped collision flags', async () =>
        (await surfaceFlagsShownIs(rig.transport, SHIPPED_GAME_FLAGS)) ? true : null,
      );
    },
    STEP_TIMEOUT_MILLISECONDS * 3,
  );

  it(
    'ships only the displacement mesh of the displaced brush in an exported GLB without the editor',
    async () => {
      const shippedFile = join(projectDirectory, 'assets', SHIPPED_SCENE_PATH);
      mkdirSync(dirname(shippedFile), { recursive: true });
      const shippedBuffer = await new GlbExporter().exportForFile(parts.world);
      expect(glbChildNamesRead(shippedBuffer, solidName)).toEqual([displacementName]);
      const shippedSurfaceNode = glbJsonRead(shippedBuffer).nodes?.find((node) => node.name === displacementName);
      expect(shippedSurfaceNode?.extras?.[DISPLACEMENT_EXPORT_COLLISION_EXTRAS_KEY]).toEqual(SHIPPED_GAME_FLAGS);
      writeFileSync(shippedFile, new Uint8Array(shippedBuffer));
      const shippedProject = previewE2eProjectCopy(projectDirectory);
      const shippedGame = new PreviewE2eGameProcess(
        shippedEnvironment.previewExecutable,
        shippedProject,
        shippedEnvironment.bridgePort,
        e2eWindowsShownRead(),
        ['--scene', SHIPPED_SCENE_PATH],
      );
      shippedGame.start();
      try {
        const transport = new PreviewLinkTransportHttp(shippedEnvironment.endpoint);
        const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
        while (performance.now() < end) {
          if (await surfaceFlagsShownIs(transport, SHIPPED_GAME_FLAGS).catch(() => false)) {
            return;
          }
          await previewE2eSleep(250);
        }
        throw new Error(`Timed out waiting for shipped ${displacementName} with its collision flags`);
      } finally {
        await shippedGame.stop();
        previewE2eProjectRemove(shippedProject);
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );
});
