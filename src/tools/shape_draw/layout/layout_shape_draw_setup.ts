import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { HandlerShapeDrawRegenerate } from '@/tools/shape_draw/handler_shape_draw_regenerate.js';

/** Editor systems the shape draw regeneration wiring reads. */
export interface LayoutShapeDrawSetupDeps {
  /** Returns the undo history. */
  commandStackRead: () => CommandStack;
  /** Returns the current object selection. */
  selectedObjectsRead: () => readonly THREE.Object3D[];
  /** Shows a status line message. */
  statusMessageShow: (message: string) => void;
  /** Refreshes viewports and panels after the world changed. */
  worldMutationRefresh: () => void;
}

/**
 * Reacts to shape draw setting changes made in the tool options chrome by
 * rebuilding the selected shape groups.
 */
export class LayoutShapeDrawSetup {
  private readonly deps: LayoutShapeDrawSetupDeps;

  /**
   * Creates the shape draw wiring.
   *
   * @param deps Editor systems read on each setting change.
   */
  constructor(deps: LayoutShapeDrawSetupDeps) {
    this.deps = deps;
  }

  /** Rebuilds the selected shape groups with the current shape parameters. */
  shapeSettingChanged(): void {
    const handler = new HandlerShapeDrawRegenerate({
      commandStack: this.deps.commandStackRead(),
      getSelectedObjects: this.deps.selectedObjectsRead,
      showStatusMessage: this.deps.statusMessageShow,
    });
    handler.run();
    this.deps.worldMutationRefresh();
  }
}
