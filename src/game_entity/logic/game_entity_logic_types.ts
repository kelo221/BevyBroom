/**
 * Entity I/O connection types and target validation states. Clean-room
 * TypeScript implementation inspired by Hammer++ and ReactiveLogic (MIT
 * License, Copyright (c) 2023 Henry de Jongh).
 */

import type * as THREE from 'three';
import type { PreviewAuthoredLogicOutput } from '@/preview/protocol/preview_protocol_placeable_types.js';

/** UserData key storing an object's authored entity I/O output connections. */
export const GAME_ENTITY_LOGIC_OUTPUTS_USERDATA_KEY = 'gameLogicOutputs';

/** UserData key storing an object's authored designer comments string. */
export const GAME_ENTITY_COMMENTS_USERDATA_KEY = 'objectComments';

/**
 * GLB node extras key carrying an exported object's entity I/O output
 * connections.
 */
export const GAME_ENTITY_LOGIC_EXPORT_EXTRAS_KEY = 'broom_logic';

/** Authored entity I/O output connection row. */
export type AuthoredLogicOutput = PreviewAuthoredLogicOutput;

/** Target resolution status shown in the Hammer++ Outputs table row indicator. */
export type LogicTargetValidationStatus = 'valid_single' | 'valid_multiple' | 'broken';

/** Universal inputs supported by every named scene object at runtime. */
export const LOGIC_UNIVERSAL_INPUT_NAMES: readonly string[] = ['Enable', 'Disable', 'Cancel'];

/**
 * One reverse-indexed incoming connection displayed in the read-only Inputs
 * tab.
 */
export interface LogicIncomingConnection {
  readonly sourceObject: THREE.Object3D;
  readonly sourceName: string;
  readonly rowIndex: number;
  readonly row: AuthoredLogicOutput;
}
