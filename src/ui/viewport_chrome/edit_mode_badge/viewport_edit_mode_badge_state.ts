import { EditorComponentMode, getEditorComponentModeLabel } from '@/types/editor_component_mode.js';
import { EditorInteractionMode } from '@/types/editor_interaction_mode.js';

/** Receives the editing state every viewport badge shows. */
export type ViewportEditModeBadgeListener = (text: string | null) => void;

/**
 * Shared editing state of the viewport badges: whether Edit Mode is on and
 * which component kind is picked. Every viewport badge listens to it so all
 * views show the same mode.
 */
export class ViewportEditModeBadgeState {
  private static interactionMode: EditorInteractionMode = EditorInteractionMode.OBJECT_MODE;
  private static componentMode: EditorComponentMode = EditorComponentMode.VERTEX;
  private static readonly listeners = new Set<ViewportEditModeBadgeListener>();

  /**
   * Sets the interaction mode and tells every badge.
   *
   * @param mode Object Mode or Edit Mode.
   */
  static interactionModeSet(mode: EditorInteractionMode): void {
    ViewportEditModeBadgeState.interactionMode = mode;
    ViewportEditModeBadgeState.listenersNotify();
  }

  /**
   * Sets the component mode and tells every badge.
   *
   * @param mode Vertex, Edge or Face.
   */
  static componentModeSet(mode: EditorComponentMode): void {
    ViewportEditModeBadgeState.componentMode = mode;
    ViewportEditModeBadgeState.listenersNotify();
  }

  /**
   * Returns the badge text for the current state.
   *
   * @returns Text such as "EDIT · VERTEX", or null outside Edit Mode.
   */
  static textRead(): string | null {
    if (ViewportEditModeBadgeState.interactionMode !== EditorInteractionMode.EDIT_MODE) {
      return null;
    }
    return `EDIT · ${getEditorComponentModeLabel(ViewportEditModeBadgeState.componentMode).toUpperCase()}`;
  }

  /**
   * Registers a badge and sends it the current text at once.
   *
   * @param listener Badge update callback.
   * @returns Function that unregisters the badge.
   */
  static listenerAdd(listener: ViewportEditModeBadgeListener): () => void {
    ViewportEditModeBadgeState.listeners.add(listener);
    listener(ViewportEditModeBadgeState.textRead());
    return () => ViewportEditModeBadgeState.listeners.delete(listener);
  }

  /** Sends the current text to every registered badge. */
  private static listenersNotify(): void {
    const text = ViewportEditModeBadgeState.textRead();
    ViewportEditModeBadgeState.listeners.forEach((listener) => listener(text));
  }
}
