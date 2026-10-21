import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandSolidModelCreate } from '@/solid/commands/model/command_solid_model_create.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';

/** A world with a command stack that issue tests fill with solid models. */
export interface IssuesTestWorld {
  world: THREE.Group;
  commandStack: CommandStack;
}

/**
 * Creates an empty world and command stack.
 *
 * @returns The world.
 */
export function issuesTestWorldCreate(): IssuesTestWorld {
  return { world: new THREE.Group(), commandStack: new CommandStack(64) };
}

/**
 * Adds a solid model to the world through the create command, optionally with
 * one additive box brush of a runtime-chosen size.
 *
 * @param testWorld World to add to.
 * @param name Model name.
 * @param withAdditiveBox Whether the model gets one additive box brush.
 * @returns The model and its brush, or null when none was added.
 */
export function issuesTestSolidModelAdd(
  testWorld: IssuesTestWorld,
  name: string,
  withAdditiveBox: boolean,
): { model: SolidModel; brush: SolidBrushInstance | null } {
  const model = new SolidModel(name);
  const brush = withAdditiveBox ? model.addBoxBrush(2 + Math.random(), SolidOperation.Additive) : null;
  model.rebuild(true);
  testWorld.commandStack.push(new CommandSolidModelCreate(model, testWorld.world));
  return { model, brush };
}

/**
 * Moves the first vertex of a brush onto the second so the brush becomes
 * invalid.
 *
 * @param brush Brush to break.
 */
export function issuesTestBrushBreak(brush: SolidBrushInstance): void {
  const source = brush.brush.vertices[0];
  const destination = brush.brush.vertices[1];
  if (!source || !destination) {
    throw new Error('brush has too few vertices to break');
  }
  destination.copy(source);
}
