import type { SprinklePointerViewportRouting } from './sprinkle_pointer_viewport_routing.js';

let sharedSprinklePointerRouting: SprinklePointerViewportRouting | null = null;

/**
 * Makes a Sprinkle pointer routing the one the editor's tools feed presses
 * into.
 *
 * @param routing Routing bound to the editor's viewports and undo stack.
 * @returns Function that removes the routing again when it is still the
 *   installed one.
 */
export function sprinklePointerRoutingSharedInstall(routing: SprinklePointerViewportRouting): () => void {
  sharedSprinklePointerRouting = routing;
  return () => {
    if (sharedSprinklePointerRouting === routing) {
      sharedSprinklePointerRouting = null;
    }
  };
}

/**
 * Returns the installed Sprinkle pointer routing.
 *
 * @returns Installed routing, or null before the viewports are set up.
 */
export function sprinklePointerRoutingSharedRead(): SprinklePointerViewportRouting | null {
  return sharedSprinklePointerRouting;
}
