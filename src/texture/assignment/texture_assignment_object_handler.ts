import type * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';

/** What a handler gives a texture to: the undo step and what it changed. */
export interface TextureAssignmentObjectChange {
  /** Undo step that gives the objects the texture. */
  readonly command: UndoCommand;
  /** Number of objects the step changes. */
  readonly objectCount: number;
  /** Plural noun of the objects, such as "procedural object(s)". */
  readonly objectNoun: string;
}

/**
 * Gives a texture picked in the texture browser to selected objects of one kind
 * whose texture lives in their own settings rather than on mesh faces.
 */
export abstract class TextureAssignmentObjectHandler {
  /**
   * Builds the undo step that gives the handler's objects among a selection a
   * texture.
   *
   * @param objects Selected objects.
   * @param textureId Picked texture id.
   * @returns The change, or null when no selected object is of the handler's
   *   kind.
   */
  abstract changeBuild(objects: readonly THREE.Object3D[], textureId: string): TextureAssignmentObjectChange | null;
}
