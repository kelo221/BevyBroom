import type { GameEntityFieldEdit, GameEntityFieldEditor } from '@/game_entity/ui/fields/game_entity_field_editor.js';

/**
 * Collects every edit an editor commits.
 *
 * @param editor Field editor.
 * @returns Live list of committed edits.
 */
export function editsCapture(editor: GameEntityFieldEditor): GameEntityFieldEdit[] {
  const edits: GameEntityFieldEdit[] = [];
  editor.bindCommit((edit) => edits.push(edit));
  return edits;
}

/**
 * Sets the value of an input or select inside an editor and fires its change
 * event.
 *
 * @param element Input or select element.
 * @param value New value.
 */
export function elementChange(element: HTMLInputElement | HTMLSelectElement | undefined | null, value: string): void {
  if (!element) {
    throw new Error('the editor has the element');
  }
  element.value = value;
  element.dispatchEvent(new Event('change'));
}
