import { FloatingPanelStack } from '@/ui/floating_panel/panel_floating_stack.js';

/** Receiver of the browser double-clicks the listener forwards. */
export interface ObjectSelectDoubleClickNativeReceiver {
  /**
   * Handles a left-button double-click outside floating panels.
   *
   * @param clientX Double-click client X.
   * @param clientY Double-click client Y.
   * @param isModifierHeld True when Shift, Ctrl or Meta modify the click.
   * @returns True when the double-click was used.
   */
  nativeDoubleClick(clientX: number, clientY: number, isModifierHeld: boolean): boolean;
}

/**
 * Forwards the browser's left-button double-click events of one document to a
 * receiver, skipping double-clicks on floating panels, menus and dialogs.
 */
export class ObjectSelectDoubleClickNativeListener {
  private readonly targetDocument: Document;
  private readonly receiver: ObjectSelectDoubleClickNativeReceiver;
  private readonly boundDoubleClick = (event: MouseEvent): void => this.doubleClickHandle(event);

  /**
   * Starts listening for double-clicks on a document.
   *
   * @param targetDocument Document whose double-clicks are forwarded.
   * @param receiver Receiver of the forwarded double-clicks.
   */
  constructor(targetDocument: Document, receiver: ObjectSelectDoubleClickNativeReceiver) {
    this.targetDocument = targetDocument;
    this.receiver = receiver;
    this.targetDocument.addEventListener('dblclick', this.boundDoubleClick);
  }

  /** Stops listening for double-clicks. */
  dispose(): void {
    this.targetDocument.removeEventListener('dblclick', this.boundDoubleClick);
  }

  /**
   * Forwards a left-button double-click that did not land on a floating panel.
   *
   * @param event Browser double-click event.
   */
  private doubleClickHandle(event: MouseEvent): void {
    if (event.button !== 0 || FloatingPanelStack.containsEventTarget(event.target)) {
      return;
    }
    const isModifierHeld = event.shiftKey || event.ctrlKey || event.metaKey;
    this.receiver.nativeDoubleClick(event.clientX, event.clientY, isModifierHeld);
  }
}
