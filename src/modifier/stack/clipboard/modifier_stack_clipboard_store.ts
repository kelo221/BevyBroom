import { ClipboardMemory } from '@/clipboard/controller/clipboard_memory.js';
import { ClipboardSystemAccess } from '@/clipboard/system/clipboard_system_access.js';
import type { ModifierStackClipboardModifiers } from './modifier_stack_clipboard.js';

/** Format marker of copied modifiers on the system clipboard. */
export const MODIFIER_STACK_CLIPBOARD_FORMAT = 'bevybroom.modifiers';

/** Newest copied-modifiers version the editor writes and reads. */
export const MODIFIER_STACK_CLIPBOARD_VERSION = 1;

/** Text form of copied modifiers. */
interface ModifierStackClipboardText extends ModifierStackClipboardModifiers {
  format: typeof MODIFIER_STACK_CLIPBOARD_FORMAT;
  version: number;
}

/**
 * Writes copied modifiers as clipboard text.
 *
 * @param data Copied modifiers.
 * @returns JSON text.
 */
export function modifierStackClipboardTextWrite(data: ModifierStackClipboardModifiers): string {
  const text: ModifierStackClipboardText = {
    format: MODIFIER_STACK_CLIPBOARD_FORMAT,
    version: MODIFIER_STACK_CLIPBOARD_VERSION,
    modifiers: data.modifiers,
  };
  return JSON.stringify(text);
}

/**
 * Reads copied modifiers from clipboard text.
 *
 * @param text Clipboard text, or null.
 * @returns Copied modifiers, or null when the text holds none.
 */
export function modifierStackClipboardTextRead(text: string | null): ModifierStackClipboardModifiers | null {
  const parsed = modifierStackClipboardJsonParse(text);
  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as Partial<ModifierStackClipboardText>;
  const versionValid = typeof candidate.version === 'number' && candidate.version <= MODIFIER_STACK_CLIPBOARD_VERSION;
  if (candidate.format !== MODIFIER_STACK_CLIPBOARD_FORMAT || !versionValid) return null;
  return Array.isArray(candidate.modifiers) ? { modifiers: candidate.modifiers } : null;
}

/**
 * Parses JSON text without throwing.
 *
 * @param text Candidate text, or null.
 * @returns Parsed value, or null when the text is not JSON.
 */
function modifierStackClipboardJsonParse(text: string | null): unknown {
  if (text === null) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Keeps copied modifiers on the system clipboard, with an in-app copy that
 * pastes when the system clipboard cannot be written or read.
 */
export class ModifierStackClipboardStore {
  /**
   * Creates the store.
   *
   * @param systemAccess System clipboard access.
   * @param memory In-app copy of the last copied text.
   */
  constructor(
    private readonly systemAccess: ClipboardSystemAccess = new ClipboardSystemAccess(),
    private readonly memory: ClipboardMemory = new ClipboardMemory(),
  ) {}

  /**
   * Copies modifiers.
   *
   * @param data Copied modifiers.
   * @returns Resolves once the system clipboard was tried.
   */
  async write(data: ModifierStackClipboardModifiers): Promise<void> {
    const text = modifierStackClipboardTextWrite(data);
    this.memory.lastCopiedTextWrite(text);
    await this.systemAccess.textWrite(text);
  }

  /**
   * Reads copied modifiers: the system clipboard when it holds some, otherwise
   * the in-app copy.
   *
   * @returns Copied modifiers, or null.
   */
  async read(): Promise<ModifierStackClipboardModifiers | null> {
    const systemText = await this.systemAccess.textRead(null);
    return modifierStackClipboardTextRead(systemText) ?? this.peek();
  }

  /**
   * Reads the in-app copy without touching the system clipboard, for menu
   * states.
   *
   * @returns Copied modifiers, or null.
   */
  peek(): ModifierStackClipboardModifiers | null {
    return modifierStackClipboardTextRead(this.memory.lastCopiedTextRead());
  }

  /**
   * Returns whether this window copied any modifiers yet.
   *
   * @returns True before the first copy.
   */
  empty(): boolean {
    return this.memory.lastCopiedTextRead() === null;
  }
}

/** Modifier clipboard shared by every modifier inspector of the window. */
export const modifierStackClipboardStoreShared = new ModifierStackClipboardStore();
