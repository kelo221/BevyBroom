import { MCP_FACE_UV_OPERATION_NAMES } from '@/ai/shared/mcp_face_uv_operation_names.js';
import type { FaceUvOperation } from '@/texture/uv/operations/face_uv_operation.js';
import { FaceUvOperationFit, type FaceUvFitAxis } from '@/texture/uv/operations/face_uv_operation_fit.js';
import { FaceUvOperationJustify, type FaceUvJustifySide } from '@/texture/uv/operations/face_uv_operation_justify.js';
import {
  FaceUvOperationAlignEdge,
  type FaceUvAlignEdgeMode,
} from '@/texture/uv/operations/face_uv_operation_align_edge.js';
import { FaceUvOperationFlip, type FaceUvFlipAxis } from '@/texture/uv/operations/face_uv_operation_flip.js';
import { FaceUvOperationRotate } from '@/texture/uv/operations/face_uv_operation_rotate.js';
import { FaceUvOperationShear, type FaceUvShearMode } from '@/texture/uv/operations/face_uv_operation_shear.js';
import { FaceUvOperationScale } from '@/texture/uv/operations/face_uv_operation_scale.js';
import { FaceUvOperationResetWorld } from '@/texture/uv/operations/face_uv_operation_reset_world.js';
import { FaceUvOperationResetFace } from '@/texture/uv/operations/face_uv_operation_reset_face.js';

/** Builder of one face UV operation from tool arguments. */
type EditorApiFaceUvOperationBuilder = (args: Record<string, unknown>) => FaceUvOperation | string;

/** Builders keyed by operation name. */
const EDITOR_API_FACE_UV_OPERATION_BUILDERS: Record<string, EditorApiFaceUvOperationBuilder> = {
  fit: (args) => new FaceUvOperationFit(faceUvFitOptionsRead(args)),
  justify: (args) => faceUvChoiceBuild(args, 'side', ['left', 'right', 'top', 'bottom', 'center'], justifyCreate),
  align_edge: (args) =>
    new FaceUvOperationAlignEdge(
      faceUvChoiceRead<FaceUvAlignEdgeMode>(args, 'mode', ['best', 'next', 'previous']) ?? 'best',
    ),
  flip: (args) => faceUvChoiceBuild(args, 'axis', ['horizontal', 'vertical'], flipCreate),
  rotate: (args) => faceUvNumberBuild(args, 'degrees', (degrees) => new FaceUvOperationRotate(degrees)),
  shear: (args) => faceUvShearBuild(args),
  scale: (args) => faceUvScaleBuild(args),
  reset_world: () => new FaceUvOperationResetWorld(),
  reset_face: () => new FaceUvOperationResetFace(),
};

/**
 * Builds the face UV operation named by the operation argument.
 *
 * @param args Tool arguments with operation and its parameters.
 * @returns Operation, or a message explaining the bad argument.
 */
export function editorApiFaceUvOperationParse(args: Record<string, unknown>): FaceUvOperation | string {
  const name = args['operation'];
  const builder = typeof name === 'string' ? EDITOR_API_FACE_UV_OPERATION_BUILDERS[name] : undefined;
  if (!builder) {
    return `operation must be one of ${MCP_FACE_UV_OPERATION_NAMES.join(', ')}`;
  }
  return builder(args);
}

/**
 * Reads the fit axis and repeat count.
 *
 * @param args Tool arguments.
 * @returns Fit options.
 */
function faceUvFitOptionsRead(args: Record<string, unknown>): { axis: FaceUvFitAxis; repeatCount?: number } {
  const axis = faceUvChoiceRead<FaceUvFitAxis>(args, 'axis', ['u', 'v', 'both']) ?? 'both';
  const repeatCount = args['repeatCount'];
  return typeof repeatCount === 'number' ? { axis, repeatCount } : { axis };
}

/**
 * Reads one string argument restricted to a set of choices.
 *
 * @param args Tool arguments.
 * @param key Argument name.
 * @param choices Accepted values.
 * @returns The value, or null when missing or not a choice.
 */
function faceUvChoiceRead<Choice extends string>(
  args: Record<string, unknown>,
  key: string,
  choices: readonly Choice[],
): Choice | null {
  const value = args[key];
  return choices.find((choice) => choice === value) ?? null;
}

/**
 * Builds an operation from a required choice argument.
 *
 * @param args Tool arguments.
 * @param key Argument name.
 * @param choices Accepted values.
 * @param create Builds the operation from the choice.
 * @returns Operation, or a message naming the accepted values.
 */
function faceUvChoiceBuild<Choice extends string>(
  args: Record<string, unknown>,
  key: string,
  choices: readonly Choice[],
  create: (choice: Choice) => FaceUvOperation,
): FaceUvOperation | string {
  const choice = faceUvChoiceRead(args, key, choices);
  return choice ? create(choice) : `${key} must be one of ${choices.join(', ')}`;
}

/**
 * Builds an operation from a required finite number argument.
 *
 * @param args Tool arguments.
 * @param key Argument name.
 * @param create Builds the operation from the number.
 * @returns Operation, or a message asking for the number.
 */
function faceUvNumberBuild(
  args: Record<string, unknown>,
  key: string,
  create: (value: number) => FaceUvOperation,
): FaceUvOperation | string {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? create(value) : `${key} must be a number`;
}

/**
 * Builds a shear operation from mode and factor.
 *
 * @param args Tool arguments.
 * @returns Operation, or a message explaining the bad argument.
 */
function faceUvShearBuild(args: Record<string, unknown>): FaceUvOperation | string {
  const mode = faceUvChoiceRead<FaceUvShearMode>(args, 'mode', ['u-by-v', 'v-by-u']) ?? 'u-by-v';
  return faceUvNumberBuild(args, 'factor', (factor) => new FaceUvOperationShear(mode, factor));
}

/**
 * Builds a scale operation from per-axis factors.
 *
 * @param args Tool arguments with factorU and factorV (each defaults to 1).
 * @returns Operation, or a message rejecting zero factors.
 */
function faceUvScaleBuild(args: Record<string, unknown>): FaceUvOperation | string {
  const factorU = typeof args['factorU'] === 'number' ? args['factorU'] : 1;
  const factorV = typeof args['factorV'] === 'number' ? args['factorV'] : 1;
  if (factorU === 0 || factorV === 0 || !Number.isFinite(factorU) || !Number.isFinite(factorV)) {
    return 'factorU and factorV must be finite and non-zero';
  }
  return new FaceUvOperationScale(factorU, factorV);
}

/**
 * Creates a justify operation.
 *
 * @param side Face side pulled onto the tile grid.
 * @returns Operation.
 */
function justifyCreate(side: FaceUvJustifySide): FaceUvOperation {
  return new FaceUvOperationJustify(side);
}

/**
 * Creates a flip operation.
 *
 * @param axis Axis mirrored.
 * @returns Operation.
 */
function flipCreate(axis: FaceUvFlipAxis): FaceUvOperation {
  return new FaceUvOperationFlip(axis);
}
