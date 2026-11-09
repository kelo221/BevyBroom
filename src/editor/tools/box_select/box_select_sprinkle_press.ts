import { sprinklePointerRoutingSharedRead } from '@/tools/sprinkle/pointer/sprinkle_pointer_routing_shared.js';
import type { EditorWindow } from '@/editor/window/editor_window.js';

/**
 * Hands the object tool's viewport presses to the installed Sprinkle pointer
 * routing while the Sprinkle tool is active, and remembers which button holds
 * the Sprinkle press.
 */
export class BoxSelectSprinklePress {
  private heldButtonIndex: number | null = null;

  /**
   * Starts a Sprinkle stroke or resize at the editor's last pointer position.
   *
   * @param editor Editor window holding the pointer position.
   * @param buttonIndex Mouse button index of the press.
   * @returns True when the Sprinkle tool now holds the press.
   */
  pressBegin(editor: EditorWindow, buttonIndex: number): boolean {
    const routing = sprinklePointerRoutingSharedRead();
    if (!routing?.isRoutingActive()) {
      return false;
    }
    const clientX = editor.lastPointerClientX;
    const clientY = editor.lastPointerClientY;
    if (!routing.pressBegin(clientX, clientY, buttonIndex, editor.lastPointerOwnerDocument)) {
      return false;
    }
    this.heldButtonIndex = buttonIndex;
    return true;
  }

  /**
   * Returns whether a button holds the Sprinkle press.
   *
   * @param buttonIndex Mouse button index.
   * @returns True while that button holds the press.
   */
  isPressHeldBy(buttonIndex: number): boolean {
    return this.heldButtonIndex === buttonIndex && this.isPressActive();
  }

  /**
   * Returns whether the Sprinkle tool holds a press.
   *
   * @returns True between a held press and its release.
   */
  isPressActive(): boolean {
    return this.heldButtonIndex !== null && sprinklePointerRoutingSharedRead()?.isPressActive() === true;
  }

  /**
   * Feeds the editor's last pointer position to the held press.
   *
   * @param editor Editor window holding the pointer position.
   */
  pressMove(editor: EditorWindow): void {
    sprinklePointerRoutingSharedRead()?.pressMove(editor.lastPointerClientX, editor.lastPointerClientY);
  }

  /**
   * Ends the held press when the released button holds it.
   *
   * @param buttonIndex Released mouse button index.
   * @returns True when the release ended the Sprinkle press.
   */
  pressEnd(buttonIndex: number): boolean {
    if (this.heldButtonIndex !== buttonIndex) {
      return false;
    }
    this.heldButtonIndex = null;
    sprinklePointerRoutingSharedRead()?.pressEnd(buttonIndex);
    return true;
  }

  /** Ends any held press, as when the tool loses focus. */
  reset(): void {
    if (this.heldButtonIndex !== null) {
      this.pressEnd(this.heldButtonIndex);
    }
  }
}
