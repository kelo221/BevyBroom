import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { CommandEntitySettingsSet } from '@/entity/commands/command_entity_settings_set.js';
import { entityScaleAbsorbCommandWrap } from '@/entity/commands/command_entity_scale_absorb.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import { LIGHT_COOKIE_ASSET_TYPE_PATH } from '@/light/model/features/light_settings_cookie.js';
import { LightOwner } from '@/light/model/light_owner.js';
import type { LightSettings } from '@/light/model/light_settings.js';
import type { PreviewBridgeStatus } from '@/preview/protocol/preview_protocol_types.js';
import { CommandTransformScale } from '@/transform/commands/command_transform_scale.js';
import { CommandStack } from '@/commands/command_stack.js';
import { ENTITY_HANDLE_SNAP_NONE } from '@/entity/handles/entity_handle.js';
import { EntityHandleDragSession } from '@/entity/handles/entity_handle_drag_session.js';
import { entityHandleTargetsOfOwner } from '@/entity/handles/entity_handle_targets.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PreviewE2eRig, type PreviewE2eGameView } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { previewE2eGameMaterialBoxCreate } from './preview_e2e_scene_parts.js';
import {
  PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT,
  PREVIEW_E2E_LIGHT_COOKIE_COMPONENT,
  PREVIEW_E2E_LIGHT_EFFECT_COMPONENT,
  PREVIEW_E2E_VOLUMETRIC_LIGHT_COMPONENT,
  previewE2eEntityRowsQuery,
  type PreviewE2eEntityRow,
} from './preview_e2e_game_query.js';

/**
 * End-to-end acceptance of DynLight light features authored in the editor: the
 * effect, cookie, fog and shimmer of a spot light reach the game as DynLight
 * components, scaling a light or dragging its radius and cone balls changes the
 * game's radius, cone and fog radius, and only bake-relevant settings mark a
 * bake stale. Skipped unless BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR
 * are set; its game listens five ports above BROOM_E2E_PORT.
 */
const environment = previewE2eEnvironmentRead(5);
const STEP_TIMEOUT_MILLISECONDS = 60000;
const BAKE_TIMEOUT_MILLISECONDS = 240000;
const FLOOR_SIZE = new THREE.Vector3(8, 0.5, 8);
const LIGHT_HEIGHT = 3;
const SCALE_FACTOR = 2;
const HANDLE_RADIUS_FACTOR = 1.5;
const HANDLE_OUTER_CUTOFF_DEGREES = 50;

const COMPANION_COMPONENTS = [
  PREVIEW_E2E_LIGHT_EFFECT_COMPONENT,
  PREVIEW_E2E_VOLUMETRIC_LIGHT_COMPONENT,
  PREVIEW_E2E_LIGHT_COOKIE_COMPONENT,
];

/** The game's only light as the tests read it. */
interface GameLight {
  row: PreviewE2eEntityRow;
  light: Record<string, unknown>;
}

/**
 * Builds a game-material floor and a spot light above it pointing down.
 *
 * @returns The world and its spot light.
 */
function lightSceneCreate(): { world: THREE.Group; spotLight: THREE.Group } {
  const world = new THREE.Group();
  const floor = previewE2eGameMaterialBoxCreate(
    'Floor',
    'stone/castle_wall',
    new THREE.Vector3(0, -FLOOR_SIZE.y / 2, 0),
    FLOOR_SIZE,
  );
  const spotLight = LightOwner.createDefault('Spot light', 'spot');
  spotLight.position.set(0, LIGHT_HEIGHT, 0);
  spotLight.rotation.x = -Math.PI / 2;
  world.add(floor, spotLight);
  return { world, spotLight };
}

/**
 * Returns whether two numbers are equal at single precision.
 *
 * @param actual Number the game reports.
 * @param expected Number the editor holds.
 * @returns True when they match.
 */
function numberMatches(actual: unknown, expected: number): boolean {
  return typeof actual === 'number' && Math.abs(actual - expected) < 1e-3;
}

/**
 * Returns the fog radius the game reports for its light.
 *
 * @param row The game light's entity row.
 * @returns Fog radius, or undefined when the light has no fog.
 */
function gameFogRadiusOf(row: PreviewE2eEntityRow): unknown {
  return (row.components[PREVIEW_E2E_VOLUMETRIC_LIGHT_COMPONENT] as { radius?: unknown } | undefined)?.radius;
}

/**
 * Creates a camera looking at a point from the front, as the editor's front
 * pane does.
 *
 * @param target Point looked at.
 * @returns Orthographic camera with a current world matrix.
 */
function frontCameraCreate(target: THREE.Vector3): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 500);
  camera.position.copy(target).add(new THREE.Vector3(0, 0, 100));
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Returns the ray a camera casts through the pixel showing a world point.
 *
 * @param camera Viewing camera.
 * @param worldPoint Point under the pointer.
 * @returns World ray.
 */
function rayToward(camera: THREE.Camera, worldPoint: THREE.Vector3): THREE.Ray {
  const ndc = worldPoint.clone().project(camera);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  return raycaster.ray.clone();
}

describe.skipIf(!environment.isConfigured)('light features in the game preview end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let spotLight: THREE.Group;
  let rig: PreviewE2eRig;
  const commandStack = new CommandStack(64);

  beforeAll(() => {
    projectDirectory = previewE2eProjectCopy(environment.sourceProjectDirectory);
    game = new PreviewE2eGameProcess(
      environment.previewExecutable,
      projectDirectory,
      environment.bridgePort,
      e2eWindowsShownRead(),
    );
    game.start();
    const scene = lightSceneCreate();
    spotLight = scene.spotLight;
    documentIdentityEnsure(scene.world);
    rig = new PreviewE2eRig(scene.world, environment.endpoint, 'light_features_level');
  });

  afterAll(async () => {
    rig?.controller.disconnect();
    await game?.stop();
    if (projectDirectory !== '') {
      previewE2eProjectRemove(projectDirectory);
    }
  });

  /**
   * Changes the spot light's settings through the editor's undoable command.
   *
   * @param changes Settings to change.
   */
  function spotSettingsChange(changes: Partial<LightSettings>): void {
    commandStack.push(
      new CommandEntitySettingsSet(LightOwner, [spotLight], (settings) => ({ ...settings, ...changes })),
    );
  }

  /**
   * Returns the spot light's current settings.
   *
   * @returns Light settings.
   */
  function spotSettingsRead(): LightSettings {
    const settings = LightOwner.settingsRead(spotLight);
    if (!settings) {
      throw new Error('the spot light has settings');
    }
    return settings;
  }

  /**
   * Keeps the editor link updating until the game's only light satisfies a
   * condition.
   *
   * @param description What is waited for.
   * @param condition Condition on the game light.
   * @param valueComponents Components whose values the condition reads; the
   *   light must carry all of them.
   * @returns The game light.
   */
  async function gameLightUntil(
    description: string,
    condition: (light: GameLight) => boolean,
    valueComponents: string[] = [PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT],
  ): Promise<GameLight> {
    const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
    while (performance.now() < end) {
      await rig.run(250);
      const rows = await previewE2eEntityRowsQuery(rig.transport, valueComponents, COMPANION_COMPONENTS).catch(
        () => [],
      );
      const row = rows.length === 1 ? rows[0] : undefined;
      const gameLight = row
        ? { row, light: row.components[PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT] as Record<string, unknown> }
        : null;
      if (gameLight && condition(gameLight)) {
        return gameLight;
      }
    }
    throw new Error(`Timed out waiting for ${description}; link error: ${rig.controller.lastErrorRead()}`);
  }

  /**
   * Keeps the editor link updating until the game's only light, which has fog,
   * satisfies a condition that may read the fog's values.
   *
   * @param description What is waited for.
   * @param condition Condition on the game light.
   * @returns The game light.
   */
  function gameFogLightUntil(description: string, condition: (light: GameLight) => boolean): Promise<GameLight> {
    return gameLightUntil(description, condition, [
      PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT,
      PREVIEW_E2E_VOLUMETRIC_LIGHT_COMPONENT,
    ]);
  }

  /**
   * Waits until the game applied everything sent and its bake is in a state.
   *
   * @param description What is waited for.
   * @param bakeState Expected bake state.
   * @param timeoutMilliseconds How long to wait.
   * @returns The game view.
   */
  function caughtUpBakeUntil(
    description: string,
    bakeState: PreviewBridgeStatus['bake_state'],
    timeoutMilliseconds: number,
  ): Promise<PreviewE2eGameView> {
    return rig.until(
      description,
      (view) => rig.isCaughtUp(view) && view.status.bake_state === bakeState,
      timeoutMilliseconds,
    );
  }

  /**
   * Returns the first image file the game offers for cookies.
   *
   * @returns Asset path of the image.
   */
  async function cookieImageFirstRead(): Promise<string> {
    await rig.until(
      'the game image files',
      (view) =>
        rig.isCaughtUp(view) &&
        (GameEntityClassRegistry.assetTypeFind(LIGHT_COOKIE_ASSET_TYPE_PATH)?.paths.length ?? 0) > 0,
      STEP_TIMEOUT_MILLISECONDS,
    );
    const path = GameEntityClassRegistry.assetTypeFind(LIGHT_COOKIE_ASSET_TYPE_PATH)?.paths[0];
    if (!path) {
      throw new Error('the game lists image files');
    }
    return path;
  }

  it(
    'sends the effect, cookie, fog and shimmer of a spot light to the game',
    async () => {
      const cookieImage = await cookieImageFirstRead();
      spotSettingsChange({
        effectKind: 'flicker',
        cookieTexture: cookieImage,
        fogEnabled: true,
        fogShape: 'cone_z',
        shimmer: 'water',
      });
      const gameLight = await gameLightUntil(
        'the light with its features',
        ({ row, light }) =>
          COMPANION_COMPONENTS.every((component) => row.has?.[component] === true) && light['shimmer'] === 'Water',
      );
      expect(gameLight.row.has?.[PREVIEW_E2E_LIGHT_COOKIE_COMPONENT]).toBe(true);
      const effects = await previewE2eEntityRowsQuery(rig.transport, [
        PREVIEW_E2E_LIGHT_EFFECT_COMPONENT,
        PREVIEW_E2E_VOLUMETRIC_LIGHT_COMPONENT,
      ]);
      expect(effects).toHaveLength(1);
      const effect = effects[0]?.components[PREVIEW_E2E_LIGHT_EFFECT_COMPONENT] as { kind?: string } | undefined;
      const fog = effects[0]?.components[PREVIEW_E2E_VOLUMETRIC_LIGHT_COMPONENT] as
        { shape?: string; radius?: number } | undefined;
      expect(effect?.kind).toBe('Flicker');
      expect(fog?.shape).toBe('ConeZ');
      expect(numberMatches(fog?.radius, spotSettingsRead().fogRadius)).toBe(true);
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'removes the features from the game when they are turned off',
    async () => {
      spotSettingsChange({ effectKind: 'steady', cookieTexture: '', fogEnabled: false, shimmer: 'none' });
      await gameLightUntil(
        'the plain light',
        ({ row, light }) =>
          COMPANION_COMPONENTS.every((component) => row.has?.[component] === false) && light['shimmer'] === 'None',
      );
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'turns scaling a light into the game light and fog radius and keeps its scale at one',
    async () => {
      spotSettingsChange({ fogEnabled: true });
      const { radius: radiusBefore, fogRadius: fogBefore } = spotSettingsRead();
      await gameFogLightUntil('the light with fog', ({ row }) => numberMatches(gameFogRadiusOf(row), fogBefore));
      const finalScale = new THREE.Vector3().setScalar(SCALE_FACTOR);
      const scale = new CommandTransformScale(
        [
          {
            object: spotLight,
            originalPosition: spotLight.position.clone(),
            originalScale: spotLight.scale.clone(),
            finalPosition: spotLight.position.clone(),
            finalScale,
          },
        ],
        spotLight.position.clone(),
        new THREE.Vector3(1, 1, 1),
        SCALE_FACTOR,
      );
      commandStack.push(entityScaleAbsorbCommandWrap(scale, [spotLight]));
      expect(spotLight.scale.toArray()).toEqual([1, 1, 1]);
      expect(spotSettingsRead().radius).toBeCloseTo(radiusBefore * SCALE_FACTOR);
      await gameFogLightUntil(
        'the wider light and fog',
        ({ row, light }) =>
          numberMatches(light['radius'], radiusBefore * SCALE_FACTOR) &&
          numberMatches(gameFogRadiusOf(row), fogBefore * SCALE_FACTOR),
      );
      expect(commandStack.undo()).toBe(true);
      await gameFogLightUntil(
        'the light and fog radius before scaling',
        ({ row, light }) =>
          numberMatches(light['radius'], radiusBefore) && numberMatches(gameFogRadiusOf(row), fogBefore),
      );
    },
    STEP_TIMEOUT_MILLISECONDS * 3,
  );

  it(
    'changes the game light radius, fog and cone when the radius and cone balls are dragged',
    async () => {
      const before = spotSettingsRead();
      spotLight.updateMatrixWorld(true);
      const camera = frontCameraCreate(spotLight.position);
      const [radiusTarget, coneTarget] = entityHandleTargetsOfOwner(spotLight);
      if (!radiusTarget || !coneTarget) {
        throw new Error('a spot light has a radius and a cone ball');
      }
      const session = new EntityHandleDragSession(commandStack, ENTITY_HANDLE_SNAP_NONE);
      const axis = new THREE.Vector3(0, 0, -1).applyQuaternion(spotLight.quaternion);
      const view = { owner: spotLight, camera };
      session.begin(radiusTarget, camera, rayToward(camera, radiusTarget.handle.worldPositionFor(view, before)));
      const radiusGoal = before.radius * HANDLE_RADIUS_FACTOR;
      session.move(rayToward(camera, spotLight.position.clone().addScaledVector(axis, radiusGoal)));
      session.end();
      const afterRadius = spotSettingsRead();
      const coneHandleStart = coneTarget.handle.worldPositionFor(view, afterRadius);
      const side = coneHandleStart
        .clone()
        .sub(spotLight.position)
        .addScaledVector(axis, -coneHandleStart.clone().sub(spotLight.position).dot(axis))
        .normalize();
      const angle = THREE.MathUtils.degToRad(HANDLE_OUTER_CUTOFF_DEGREES);
      const coneGoal = spotLight.position
        .clone()
        .addScaledVector(axis, Math.cos(angle))
        .addScaledVector(side, Math.sin(angle));
      session.begin(coneTarget, camera, rayToward(camera, coneHandleStart));
      session.move(rayToward(camera, coneGoal));
      session.end();
      const dragged = spotSettingsRead();
      expect(dragged.radius).toBeCloseTo(radiusGoal, 3);
      expect(dragged.outerCutoffDegrees).toBeCloseTo(HANDLE_OUTER_CUTOFF_DEGREES, 3);
      expect(dragged.fogRadius).toBeCloseTo(before.fogRadius * HANDLE_RADIUS_FACTOR, 3);
      await gameFogLightUntil(
        'the dragged radius, cone and fog',
        ({ row, light }) =>
          numberMatches(light['radius'], dragged.radius) &&
          numberMatches(light['outer_cutoff'], dragged.outerCutoffDegrees) &&
          numberMatches(light['inner_cutoff'], dragged.innerCutoffDegrees) &&
          numberMatches(gameFogRadiusOf(row), dragged.fogRadius),
      );
      expect(commandStack.undo() && commandStack.undo()).toBe(true);
      await gameFogLightUntil(
        'the radius, cone and fog before dragging',
        ({ row, light }) =>
          numberMatches(light['radius'], before.radius) &&
          numberMatches(light['outer_cutoff'], before.outerCutoffDegrees) &&
          numberMatches(gameFogRadiusOf(row), before.fogRadius),
      );
    },
    STEP_TIMEOUT_MILLISECONDS * 3,
  );

  it(
    'keeps a bake current after an effect change and marks it stale after an illumination change',
    async () => {
      await rig.controller.previewBakeRequest();
      await caughtUpBakeUntil('a current bake', 'current', BAKE_TIMEOUT_MILLISECONDS);
      spotSettingsChange({ effectKind: 'candle' });
      await gameLightUntil('the candle effect', ({ row }) => row.has?.[PREVIEW_E2E_LIGHT_EFFECT_COMPONENT] === true);
      await caughtUpBakeUntil('the bake still current after the effect', 'current', STEP_TIMEOUT_MILLISECONDS);
      spotSettingsChange({ illumination: 'single_bounce' });
      await gameLightUntil('the single bounce light', ({ light }) => light['illumination'] === 'SingleBounce');
      await caughtUpBakeUntil('a stale bake', 'needs_bake', STEP_TIMEOUT_MILLISECONDS);
    },
    BAKE_TIMEOUT_MILLISECONDS * 2,
  );
});
