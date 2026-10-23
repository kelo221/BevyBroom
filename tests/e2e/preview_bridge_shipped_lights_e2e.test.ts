import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as THREE from 'three';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PreviewE2eRig, previewE2eSleep } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { previewE2eGameMaterialBoxCreate } from './preview_e2e_scene_parts.js';
import {
  PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT,
  previewE2eEntityRowsQuery,
  type PreviewE2eEntityRow,
} from './preview_e2e_game_query.js';

/**
 * End-to-end acceptance of lights in shipped levels: a game that loads only the
 * exported GLB gets every light setting, including those DynLight's own extras
 * cannot carry, and a game that shows the same document from the editor as well
 * lights each light once. Skipped unless BROOM_E2E_PREVIEW_EXE and
 * BROOM_E2E_PROJECT_DIR are set; its game listens thirteen ports above
 * BROOM_E2E_PORT.
 */
const environment = previewE2eEnvironmentRead(13);
const SHIPPED_SCENE_PATH = 'shipped/shipped_light_level.glb';
const STEP_TIMEOUT_MILLISECONDS = 60000;
const CHECK_INTERVAL_MILLISECONDS = 250;
const SHIPPED_LIGHT_COMPONENT = 'broom_bridge::authoring::shipped_lights::ShippedLight';
const SHIPPED_LIGHT_REPLACED_COMPONENT = 'broom_bridge::authoring::shipped_lights::ShippedLightReplaced';

/** Editor objects of the shipped light scene. */
interface ShippedLightScene {
  world: THREE.Group;
  light: THREE.Group;
}

/**
 * What the game shows of the scene's light, read through the Bevy remote
 * protocol.
 */
interface ShippedLightView {
  shiningLights: PreviewE2eEntityRow[];
  shippedLights: PreviewE2eEntityRow[];
}

/**
 * Builds a floor with a game material and a spot light whose shadows are
 * realtime, a setting DynLight's own light extras cannot carry.
 *
 * @returns The scene.
 */
function shippedLightSceneCreate(): ShippedLightScene {
  const world = new THREE.Group();
  const floor = previewE2eGameMaterialBoxCreate(
    'Floor',
    'stone/castle_wall',
    new THREE.Vector3(0, -0.5, 0),
    new THREE.Vector3(8, 1, 8),
  );
  const light = LightOwner.create('Shipped spot', { ...lightSettingsCreateDefault('spot'), shadows: 'realtime' });
  light.position.set(0, 2, 0);
  light.rotation.x = -Math.PI / 2;
  world.add(floor, light);
  return { world, light };
}

/**
 * Reads the shining DynLight lights and the shipped light nodes of a game.
 *
 * @param transport Transport to the game's bridge.
 * @returns The view, or null while the game does not answer.
 */
async function shippedLightViewRead(transport: PreviewLinkTransportHttp): Promise<ShippedLightView | null> {
  try {
    const shiningLights = await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT]);
    const shippedLights = await previewE2eEntityRowsQuery(
      transport,
      [SHIPPED_LIGHT_COMPONENT],
      [SHIPPED_LIGHT_REPLACED_COMPONENT, PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT],
    );
    return { shiningLights, shippedLights };
  } catch {
    return null;
  }
}

/**
 * Waits until the game's light view satisfies a condition, keeping the editor's
 * link ticking when there is one.
 *
 * @param transport Transport to the game's bridge.
 * @param rig Editor link to tick while waiting, or null when the game runs
 *   without the editor.
 * @param description What is waited for, used in the timeout error.
 * @param condition Condition on the light view.
 * @returns The view that satisfied the condition.
 */
async function shippedLightViewUntil(
  transport: PreviewLinkTransportHttp,
  rig: PreviewE2eRig | null,
  description: string,
  condition: (view: ShippedLightView) => boolean,
): Promise<ShippedLightView> {
  const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
  let view: ShippedLightView | null = null;
  while (performance.now() < end) {
    await (rig === null ? previewE2eSleep(CHECK_INTERVAL_MILLISECONDS) : rig.run(CHECK_INTERVAL_MILLISECONDS));
    view = await shippedLightViewRead(transport);
    if (view !== null && condition(view)) {
      return view;
    }
  }
  throw new Error(`Timed out waiting for ${description}; last view: ${JSON.stringify(view)}`);
}

/**
 * Returns whether a shipped light row carries the editor id of a light and, per
 * its optional components, is switched off or shining.
 *
 * @param row Shipped light row.
 * @param lightIdentifier Editor id of the light.
 * @param isReplaced Whether the row must be switched off in favor of the
 *   editor's light.
 * @returns True when the row matches.
 */
function shippedLightRowIs(row: PreviewE2eEntityRow, lightIdentifier: string, isReplaced: boolean): boolean {
  return (
    row.components[SHIPPED_LIGHT_COMPONENT] === lightIdentifier &&
    row.has?.[SHIPPED_LIGHT_REPLACED_COMPONENT] === isReplaced &&
    row.has?.[PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT] === !isReplaced
  );
}

/**
 * Reads the shadow mode of a shining DynLight light row.
 *
 * @param row Shining light row.
 * @returns The reflected shadow mode.
 */
function shadowModeRead(row: PreviewE2eEntityRow | undefined): unknown {
  return (row?.components[PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT] as { shadows?: unknown } | undefined)?.shadows;
}

describe.skipIf(!environment.isConfigured)('shipped level lights end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let scene: ShippedLightScene;
  let rig: PreviewE2eRig | null = null;
  let transport: PreviewLinkTransportHttp;

  beforeAll(async () => {
    scene = shippedLightSceneCreate();
    documentIdentityEnsure(scene.world);
    projectDirectory = previewE2eProjectCopy(environment.sourceProjectDirectory);
    const shippedFile = join(projectDirectory, 'assets', SHIPPED_SCENE_PATH);
    mkdirSync(dirname(shippedFile), { recursive: true });
    writeFileSync(shippedFile, new Uint8Array(await new GlbExporter().exportForFile(scene.world)));
    game = new PreviewE2eGameProcess(
      environment.previewExecutable,
      projectDirectory,
      environment.bridgePort,
      e2eWindowsShownRead(),
      ['--scene', SHIPPED_SCENE_PATH],
    );
    game.start();
    transport = new PreviewLinkTransportHttp(environment.endpoint);
  });

  afterAll(async () => {
    rig?.controller.disconnect();
    await game?.stop();
    if (projectDirectory !== '') {
      previewE2eProjectRemove(projectDirectory);
    }
  });

  it(
    'applies every exported light setting in a game that loads only the GLB',
    async () => {
      const view = await shippedLightViewUntil(transport, null, 'the shipped light with realtime shadows', (next) => {
        const isShipped = next.shippedLights.some((row) => shippedLightRowIs(row, scene.light.uuid, false));
        return isShipped && next.shiningLights.length === 1 && shadowModeRead(next.shiningLights[0]) === 'Realtime';
      });
      expect(view.shiningLights).toHaveLength(1);
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'lights each light once while the editor shows the same document',
    async () => {
      const editorLink = new PreviewE2eRig(scene.world, environment.endpoint, 'shipped_light_level');
      rig = editorLink;
      await editorLink.until(
        'the editor document applied',
        (next) => editorLink.isCaughtUp(next),
        STEP_TIMEOUT_MILLISECONDS,
      );
      const view = await shippedLightViewUntil(transport, editorLink, 'one light with the shipped one off', (next) => {
        const isReplaced = next.shippedLights.some((row) => shippedLightRowIs(row, scene.light.uuid, true));
        return isReplaced && next.shiningLights.length === 1;
      });
      expect(shadowModeRead(view.shiningLights[0])).toBe('Realtime');
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'brings the shipped light back when the shown document no longer has it',
    async () => {
      const editorLink = rig;
      expect(editorLink).not.toBeNull();
      if (editorLink === null) return;
      scene.world.remove(scene.light);
      await editorLink.until(
        'the light removed in the editor',
        (next) => editorLink.isCaughtUp(next),
        STEP_TIMEOUT_MILLISECONDS,
      );
      const view = await shippedLightViewUntil(transport, editorLink, 'the shipped light shining again', (next) => {
        const isShining = next.shippedLights.some((row) => shippedLightRowIs(row, scene.light.uuid, false));
        return isShining && next.shiningLights.length === 1;
      });
      expect(view.shippedLights).toHaveLength(1);
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );
});
