import { afterEach, describe, expect, it } from 'vitest';
import { TextSelectionSuppression } from '@/ui/text_selection/text_selection_suppression.js';

/**
 * Creates a paragraph of page text and selects all of it.
 *
 * @returns The selected paragraph.
 */
function pageTextSelect(): HTMLElement {
  const paragraph = document.createElement('p');
  paragraph.textContent = 'selectable page text';
  document.body.appendChild(paragraph);
  document.getSelection()?.selectAllChildren(paragraph);
  return paragraph;
}

/**
 * A text selection suppression clears the page selection, turns text selection
 * off on the body while active and puts the body's own setting back after.
 */
describe('TextSelectionSuppression', () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.body.style.userSelect = '';
    document.getSelection()?.removeAllRanges();
  });

  it('clears the selection and turns body text selection off while active', () => {
    pageTextSelect();
    expect(document.getSelection()?.toString()).not.toBe('');
    const suppression = new TextSelectionSuppression(document);
    suppression.begin();
    expect(suppression.isActive()).toBe(true);
    expect(document.getSelection()?.toString()).toBe('');
    expect(document.body.style.userSelect).toBe('none');
  });

  it("restores the body's earlier text selection setting and clears selections made meanwhile", () => {
    document.body.style.userSelect = 'text';
    const suppression = new TextSelectionSuppression(document);
    suppression.begin();
    pageTextSelect();
    suppression.end();
    expect(suppression.isActive()).toBe(false);
    expect(document.body.style.userSelect).toBe('text');
    expect(document.getSelection()?.toString()).toBe('');
  });

  it('keeps the first saved setting when begun twice and ignores an end without a begin', () => {
    const suppression = new TextSelectionSuppression(document);
    suppression.end();
    expect(document.body.style.userSelect).toBe('');
    suppression.begin();
    suppression.begin();
    suppression.end();
    expect(document.body.style.userSelect).toBe('');
  });
});
