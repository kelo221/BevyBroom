import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClipboardEventBridge, type ClipboardEventBridgeCommands } from '@/clipboard/bridge/clipboard_event_bridge.js';

/** Clipboard data that stores text by type, like a browser's DataTransfer. */
class ClipboardTestData {
  private readonly textByType = new Map<string, string>();

  /**
   * Returns stored text of a type.
   *
   * @param type MIME type.
   * @returns Stored text, or an empty string.
   */
  getData(type: string): string {
    return this.textByType.get(type) ?? '';
  }

  /**
   * Stores text of a type.
   *
   * @param type MIME type.
   * @param text Text to store.
   */
  setData(type: string, text: string): void {
    this.textByType.set(type, text);
  }
}

/**
 * Dispatches a cancelable clipboard event with clipboard data on a target.
 *
 * @param target Element the event is aimed at.
 * @param type Event type.
 * @param data Clipboard data carried by the event.
 * @returns The dispatched event.
 */
function clipboardEventDispatch(target: EventTarget, type: 'copy' | 'cut' | 'paste', data: ClipboardTestData): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: data });
  target.dispatchEvent(event);
  return event;
}

/**
 * Creates spy clipboard commands that copy a fixed text and accept pastes.
 *
 * @param copiedText Text copy and cut return, or null when nothing is selected.
 * @returns Spy commands.
 */
function commandsCreate(copiedText: string | null): ClipboardEventBridgeCommands & {
  pasteAtCursor: ReturnType<typeof vi.fn>;
} {
  const result = copiedText === null ? null : { text: copiedText };
  return { copy: vi.fn(() => result), cut: vi.fn(() => result), pasteAtCursor: vi.fn(() => ({})) };
}

/** Copy, cut and paste events of the document run the editor clipboard. */
describe('ClipboardEventBridge', () => {
  const bridges: ClipboardEventBridge[] = [];

  afterEach(() => {
    bridges.splice(0).forEach((bridge) => bridge.unregister());
    document.body.replaceChildren();
    document.getSelection()?.removeAllRanges();
  });

  /**
   * Creates and registers a bridge on the test document.
   *
   * @param commands Commands the bridge runs.
   * @returns The bridge.
   */
  function bridgeRegister(commands: ClipboardEventBridgeCommands): ClipboardEventBridge {
    const bridge = new ClipboardEventBridge(document, commands);
    bridge.register();
    bridges.push(bridge);
    return bridge;
  }

  it('writes copied and cut text into the event and stops the default copy', () => {
    const commands = commandsCreate('payload');
    bridgeRegister(commands);
    const copyData = new ClipboardTestData();
    const copyEvent = clipboardEventDispatch(document.body, 'copy', copyData);
    const cutData = new ClipboardTestData();
    const cutEvent = clipboardEventDispatch(document.body, 'cut', cutData);
    expect(copyData.getData('text/plain')).toBe('payload');
    expect(cutData.getData('text/plain')).toBe('payload');
    expect(copyEvent.defaultPrevented).toBe(true);
    expect(cutEvent.defaultPrevented).toBe(true);
  });

  it('keeps the default copy when nothing was copied', () => {
    bridgeRegister(commandsCreate(null));
    const event = clipboardEventDispatch(document.body, 'copy', new ClipboardTestData());
    expect(event.defaultPrevented).toBe(false);
  });

  it('pastes the event text and stops the default paste only when something was pasted', () => {
    const commands = commandsCreate('payload');
    bridgeRegister(commands);
    const data = new ClipboardTestData();
    data.setData('text/plain', 'clipboard text');
    expect(clipboardEventDispatch(document.body, 'paste', data).defaultPrevented).toBe(true);
    expect(commands.pasteAtCursor).toHaveBeenCalledWith('clipboard text');
    commands.pasteAtCursor.mockReturnValue(null);
    expect(clipboardEventDispatch(document.body, 'paste', data).defaultPrevented).toBe(false);
  });

  it('leaves events aimed at text fields alone', () => {
    const commands = commandsCreate('payload');
    bridgeRegister(commands);
    const input = document.createElement('input');
    const textArea = document.createElement('textarea');
    document.body.append(input, textArea);
    const copyEvent = clipboardEventDispatch(input, 'copy', new ClipboardTestData());
    const pasteEvent = clipboardEventDispatch(textArea, 'paste', new ClipboardTestData());
    expect(copyEvent.defaultPrevented).toBe(false);
    expect(pasteEvent.defaultPrevented).toBe(false);
    expect(commands.copy).not.toHaveBeenCalled();
    expect(commands.pasteAtCursor).not.toHaveBeenCalled();
  });

  it('leaves copies of selected page text alone', () => {
    const commands = commandsCreate('payload');
    bridgeRegister(commands);
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Readable help text';
    document.body.append(paragraph);
    document.getSelection()?.selectAllChildren(paragraph);
    const event = clipboardEventDispatch(paragraph, 'copy', new ClipboardTestData());
    expect(event.defaultPrevented).toBe(false);
    expect(commands.copy).not.toHaveBeenCalled();
  });

  it('stops running commands once unregistered', () => {
    const commands = commandsCreate('payload');
    bridgeRegister(commands).unregister();
    clipboardEventDispatch(document.body, 'copy', new ClipboardTestData());
    expect(commands.copy).not.toHaveBeenCalled();
  });
});
