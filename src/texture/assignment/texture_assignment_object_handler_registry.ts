import type * as THREE from 'three';
import { ProceduralTextureAssignmentHandler } from '@/procedural/texture/procedural_texture_assignment_handler.js';
import type {
  TextureAssignmentObjectChange,
  TextureAssignmentObjectHandler,
} from '@/texture/assignment/texture_assignment_object_handler.js';
import { RegistryExtensible } from '@/utils/registry/registry_extensible.js';

/**
 * Returns the handlers the editor ships with.
 *
 * @returns Handlers in the order they are asked.
 */
function textureAssignmentObjectHandlersBuiltinCreate(): readonly TextureAssignmentObjectHandler[] {
  return [new ProceduralTextureAssignmentHandler()];
}

/**
 * Finds the handler that gives a picked texture to selected objects whose
 * texture lives in their settings: the built-in handlers and handlers features
 * register at runtime.
 */
export class TextureAssignmentObjectHandlerRegistry {
  private static readonly handlers = new RegistryExtensible<TextureAssignmentObjectHandler>(
    textureAssignmentObjectHandlersBuiltinCreate,
  );

  /**
   * Adds a handler.
   *
   * @param handler Handler to add.
   */
  static register(handler: TextureAssignmentObjectHandler): void {
    TextureAssignmentObjectHandlerRegistry.handlers.register(handler);
  }

  /**
   * Removes a handler added with {@link register}.
   *
   * @param handler Handler to remove.
   */
  static unregister(handler: TextureAssignmentObjectHandler): void {
    TextureAssignmentObjectHandlerRegistry.handlers.unregister(handler);
  }

  /**
   * Returns the change of the first handler that has objects in a selection.
   *
   * @param objects Selected objects.
   * @param textureId Picked texture id.
   * @returns The change, or null when no handler has objects in the selection.
   */
  static changeBuild(objects: readonly THREE.Object3D[], textureId: string): TextureAssignmentObjectChange | null {
    for (const handler of TextureAssignmentObjectHandlerRegistry.handlers.list()) {
      const change = handler.changeBuild(objects, textureId);
      if (change !== null) {
        return change;
      }
    }
    return null;
  }
}
