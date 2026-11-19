import * as THREE from 'three';
import { GlbSceneParser } from '@/io/glb/glb_scene_parser.js';
import { playerCharacterModelUrl } from './player_character_model_url.js';
import { playerCharacterPrepareModelScene } from './player_character_model_prepare.js';

let preparedTemplate: THREE.Group | null = null;
let loadPromise: Promise<THREE.Group> | null = null;

/**
 * Returns whether a prepared character template is ready for cloning.
 *
 * @returns True when buildRig can run synchronously.
 */
export function playerCharacterIsModelReady(): boolean {
  return preparedTemplate !== null;
}

/**
 * Ensures the bundled character model is loaded and prepared.
 *
 * @param modelUrl Optional override URL for tests.
 * @returns Promise resolving to the prepared template group.
 */
export function playerCharacterEnsureModelLoaded(modelUrl?: string): Promise<THREE.Group> {
  if (preparedTemplate) {
    return Promise.resolve(preparedTemplate);
  }
  if (loadPromise) {
    return loadPromise;
  }
  const url = modelUrl ?? playerCharacterModelUrl();
  loadPromise = loadModelFromUrl(url)
    .then((template) => {
      preparedTemplate = template;
      return template;
    })
    .catch((error: unknown) => {
      loadPromise = null;
      throw error;
    });
  return loadPromise;
}

/**
 * Loads and prepares a character model from a raw ArrayBuffer or byte view.
 *
 * @param buffer Binary glTF buffer or typed view over one.
 * @returns Promise resolving when the template is ready.
 */
export async function playerCharacterLoadModelFromArrayBuffer(buffer: ArrayBuffer | ArrayBufferView): Promise<void> {
  const scene = await GlbSceneParser.parse(buffer);
  preparedTemplate = playerCharacterPrepareModelScene(scene);
  loadPromise = Promise.resolve(preparedTemplate);
}

/**
 * Returns the prepared template when available.
 *
 * @returns Prepared template group, or null.
 */
export function playerCharacterGetPreparedTemplate(): THREE.Group | null {
  return preparedTemplate;
}

/** Clears the cached template so the next ensure call reloads. */
export function playerCharacterResetModelLoader(): void {
  preparedTemplate = null;
  loadPromise = null;
}

/**
 * Fetches and prepares a model from a URL.
 *
 * @param url Model asset URL.
 * @returns Prepared template group.
 */
async function loadModelFromUrl(url: string): Promise<THREE.Group> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load character model: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  const scene = await GlbSceneParser.parse(buffer);
  return playerCharacterPrepareModelScene(scene);
}
