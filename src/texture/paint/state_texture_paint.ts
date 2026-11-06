import { DEFAULT_CHECKER_TEXTURE_ID } from '@/texture/library/texture_id.js';

/** Listener notified when the active paint texture id changes. */
export type StateTexturePaintListener = (textureId: string) => void;

/** Tracks the last texture chosen in the browser for paint / fill operations. */
export class StateTexturePaint {
  private lastTextureId: string;
  private readonly listeners: Set<StateTexturePaintListener>;

  /** Creates paint state defaulting to the built-in checker. */
  constructor() {
    this.lastTextureId = DEFAULT_CHECKER_TEXTURE_ID;
    this.listeners = new Set();
  }

  /**
   * Returns the last selected texture id.
   *
   * @returns Texture id (never empty).
   */
  getLastTextureId(): string {
    return this.lastTextureId;
  }

  /**
   * Records the last selected texture id for fills and new surfaces.
   *
   * @param textureId Texture id to remember.
   */
  setLastTextureId(textureId: string): void {
    if (!textureId || this.lastTextureId === textureId) {
      return;
    }
    this.lastTextureId = textureId;
    this.listenersNotify();
  }

  /**
   * Registers a listener called whenever the current paint texture changes.
   *
   * @param listener Callback receiving the new texture id.
   * @returns Unsubscribe function.
   */
  changeListenerAdd(listener: StateTexturePaintListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Resets to the built-in checker (tests / teardown). */
  reset(): void {
    this.lastTextureId = DEFAULT_CHECKER_TEXTURE_ID;
    this.listenersNotify();
  }

  /** Notifies all registered texture paint listeners. */
  private listenersNotify(): void {
    const current = this.lastTextureId;
    this.listeners.forEach((listener) => listener(current));
  }
}

let sharedPaintState: StateTexturePaint | null = null;

/**
 * Returns the process-wide paint state singleton.
 *
 * @returns Shared TexturePaintState.
 */
export function getStateTexturePaint(): StateTexturePaint {
  if (!sharedPaintState) {
    sharedPaintState = new StateTexturePaint();
  }
  return sharedPaintState;
}

/**
 * Replaces the shared paint state (tests only).
 *
 * @param state State to install, or null to clear.
 */
export function setStateTexturePaintForTests(state: StateTexturePaint | null): void {
  sharedPaintState = state;
}
