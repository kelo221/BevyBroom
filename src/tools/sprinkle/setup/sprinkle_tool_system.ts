import type * as THREE from 'three';
import { SprinkleOverlaySystem } from '@/tools/sprinkle/overlay/sprinkle_overlay_system.js';
import type { SprinkleBrushHoverViewport } from '@/tools/sprinkle/overlay/router_sprinkle_brush_hover.js';
import {
  RouterSprinklePointer,
  type RouterSprinklePointerDeps,
} from '@/tools/sprinkle/pointer/router_sprinkle_pointer.js';
import { SprinklePointerViewportRouting } from '@/tools/sprinkle/pointer/sprinkle_pointer_viewport_routing.js';
import { sprinklePointerRoutingSharedInstall } from '@/tools/sprinkle/pointer/sprinkle_pointer_routing_shared.js';
import { sprinkleRadiusWheelConsumerInstall } from '@/tools/sprinkle/radius/sprinkle_radius_wheel_consumer.js';
import {
  sprinkleRadiusShortcutsRegister,
  type SprinkleRadiusShortcutHost,
} from '@/tools/sprinkle/radius/sprinkle_radius_shortcut_bindings.js';

/** Services the Sprinkle tool works with in the editor layout. */
export interface SprinkleToolSystemDeps extends RouterSprinklePointerDeps {
  /** Editor-only helper parent outside the world hierarchy. */
  readonly helperParent: THREE.Object3D;
  /** Returns every interactive viewport, 2D and 3D. */
  readonly viewportsRead: () => readonly SprinkleBrushHoverViewport[];
  /** Keyboard handler the radius shrink and grow shortcuts register with. */
  readonly shortcutHost: SprinkleRadiusShortcutHost;
}

/**
 * The Sprinkle tool in the editor layout: the pointer router that paints, the
 * viewport routing the object tool feeds presses into, installed as the shared
 * routing, the radius cursor, and the Alt+wheel and keyboard radius steps.
 */
export class SprinkleToolSystem {
  /** Paints strokes and resizes the brush. */
  readonly pointerRouter: RouterSprinklePointer;
  /** Feeds client-point presses into the pointer router. */
  readonly viewportRouting: SprinklePointerViewportRouting;
  /** Radius cursor. */
  readonly overlaySystem: SprinkleOverlaySystem;
  private readonly routingUninstall: () => void;
  private readonly radiusWheelUninstall: () => void;
  private readonly radiusShortcutsUnregister: () => void;

  /**
   * Creates and installs the Sprinkle tool.
   *
   * @param deps Undo stack, world, viewports, modifier keys, keyboard
   *   shortcuts, status and refresh services.
   */
  constructor(deps: SprinkleToolSystemDeps) {
    this.radiusWheelUninstall = sprinkleRadiusWheelConsumerInstall();
    this.radiusShortcutsUnregister = sprinkleRadiusShortcutsRegister(deps.shortcutHost);
    this.pointerRouter = new RouterSprinklePointer(deps);
    this.viewportRouting = new SprinklePointerViewportRouting(this.pointerRouter, deps.viewportsRead);
    this.routingUninstall = sprinklePointerRoutingSharedInstall(this.viewportRouting);
    this.overlaySystem = new SprinkleOverlaySystem({
      helperParent: deps.helperParent,
      viewportsRead: deps.viewportsRead,
      press: this.pointerRouter,
    });
  }

  /** Updates the radius cursor for the coming frame. */
  frameUpdate(): void {
    this.overlaySystem.frameUpdate();
  }

  /**
   * Ends any press, uninstalls the routing and the radius steps and releases
   * the cursor.
   */
  dispose(): void {
    this.pointerRouter.dispose();
    this.routingUninstall();
    this.radiusWheelUninstall();
    this.radiusShortcutsUnregister();
    this.overlaySystem.dispose();
  }
}
