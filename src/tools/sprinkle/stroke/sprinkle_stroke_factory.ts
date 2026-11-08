import { getStateSprinkleDefinitionLibrary } from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';
import {
  SprinkleSurfaceProjector,
  sprinkleSurfaceMeshesCollect,
} from '@/tools/sprinkle/surface/sprinkle_surface_projector.js';
import type { SprinkleConfig, SprinklePlacementMode } from '@/tools/sprinkle/sprinkle_types.js';
import { SprinkleStroke } from './sprinkle_stroke.js';
import { sprinkleStrokeSettingsFromConfig } from './sprinkle_stroke_settings.js';
import type { SprinkleStrokeDeps } from './sprinkle_stroke_types.js';

/** Services a stroke needs besides its surface projector. */
export type SprinkleStrokeServices = Omit<SprinkleStrokeDeps, 'projector'>;

/** A started stroke, or why none could start. */
export type SprinkleStrokeCreateResult =
  { readonly ok: true; readonly stroke: SprinkleStroke } | { readonly ok: false; readonly message: string };

/** Mode and seed one stroke is started with. */
export interface SprinkleStrokeStart {
  /** Mode of the stroke. */
  readonly mode: SprinklePlacementMode;
  /** Seed of the stroke's random stream. */
  readonly seed: number;
}

/**
 * Creates a projector over the surfaces of a world as they are now.
 *
 * @param services Services holding the world root.
 * @returns Surface projector.
 */
export function sprinkleSurfaceProjectorCreate(services: SprinkleStrokeServices): SprinkleSurfaceProjector {
  return new SprinkleSurfaceProjector(sprinkleSurfaceMeshesCollect(services.worldObject));
}

/**
 * Starts a stroke of the configured definition.
 *
 * @param services Undo stack, world and refresh services.
 * @param projector Projector over the surfaces entities land on.
 * @param config Sprinkle configuration naming the definition.
 * @param start Mode and seed of the stroke.
 * @returns The stroke, or a message when the definition is not loaded.
 */
export function sprinkleStrokeCreate(
  services: SprinkleStrokeServices,
  projector: SprinkleSurfaceProjector,
  config: SprinkleConfig,
  start: SprinkleStrokeStart,
): SprinkleStrokeCreateResult {
  const definition = getStateSprinkleDefinitionLibrary().definitionFind(config.definitionName);
  if (!definition) {
    return { ok: false, message: sprinkleDefinitionMissingMessage(config.definitionName) };
  }
  const settings = sprinkleStrokeSettingsFromConfig(config, definition, start.mode, start.seed);
  return { ok: true, stroke: new SprinkleStroke({ ...services, projector }, settings) };
}

/**
 * Returns the message shown when a stroke has no loaded definition.
 *
 * @param definitionName Configured definition name, or null.
 * @returns Message text.
 */
function sprinkleDefinitionMissingMessage(definitionName: string | null): string {
  return definitionName === null ? 'Choose a sprinkle type first' : `Unknown sprinkle type: ${definitionName}`;
}
