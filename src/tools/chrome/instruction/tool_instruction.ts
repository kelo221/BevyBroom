import { keyboardHintFormat } from '@/settings/keyboard/keyboard_hint_format.js';

/** Shape Editor–style usage instruction for a tool or action button. */
export interface ToolInstruction {
  /** Short title shown first in the tooltip. */
  title: string;
  /**
   * Multi-line description of how to use the tool, with modifier and key
   * placeholders such as "{ctrl}" and "{keyname:Delete}".
   */
  description: string;
  /**
   * Optional keyboard shortcut label template (for example "Tab" or
   * "{shift}+E").
   */
  shortcut?: string;
}

/**
 * Formats an instruction into tooltip body text with the modifier and key names
 * of the platform.
 *
 * @param instruction Instruction fields.
 * @returns Multi-line tooltip string.
 */
export function formatToolInstructionTooltip(instruction: ToolInstruction): string {
  const titleLine = formatToolInstructionTitleLine(instruction);
  if (instruction.description.trim().length === 0) {
    return titleLine;
  }
  return keyboardHintFormat(`${titleLine}\n\n${instruction.description.trim()}`);
}

/**
 * Formats the title line including an optional shortcut.
 *
 * @param instruction Instruction fields.
 * @returns Single-line title.
 */
function formatToolInstructionTitleLine(instruction: ToolInstruction): string {
  const title = instruction.title.trim();
  const shortcut = instruction.shortcut?.trim();
  if (!shortcut) {
    return keyboardHintFormat(title);
  }
  return keyboardHintFormat(`${title} (${shortcut})`);
}
