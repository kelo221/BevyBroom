import { afterEach, describe, expect, it } from 'vitest';
import { ViewportEditModeBadge } from '@/ui/viewport_chrome/edit_mode_badge/viewport_edit_mode_badge.js';
import { ViewportEditModeBadgeState } from '@/ui/viewport_chrome/edit_mode_badge/viewport_edit_mode_badge_state.js';
import { EditorComponentMode, getEditorComponentModeLabel } from '@/types/editor_component_mode.js';
import { EditorInteractionMode } from '@/types/editor_interaction_mode.js';

/** Proves every viewport shows which component kind Edit Mode edits. */
describe('ViewportEditModeBadge', () => {
  afterEach(() => {
    ViewportEditModeBadgeState.interactionModeSet(EditorInteractionMode.OBJECT_MODE);
    ViewportEditModeBadgeState.componentModeSet(EditorComponentMode.VERTEX);
  });

  it('stays hidden in Object Mode', () => {
    const badge = new ViewportEditModeBadge(document.createElement('div'));
    expect(badge.getElement().style.display).toBe('none');
    badge.dispose();
  });

  it('names the component mode in every badge while Edit Mode is on', () => {
    const first = new ViewportEditModeBadge(document.createElement('div'));
    const second = new ViewportEditModeBadge(document.createElement('div'));
    ViewportEditModeBadgeState.interactionModeSet(EditorInteractionMode.EDIT_MODE);
    for (const mode of [EditorComponentMode.VERTEX, EditorComponentMode.EDGE, EditorComponentMode.FACE]) {
      ViewportEditModeBadgeState.componentModeSet(mode);
      const label = getEditorComponentModeLabel(mode).toUpperCase();
      expect(first.getElement().textContent).toContain(label);
      expect(second.getElement().textContent).toContain(label);
      expect(first.getElement().style.display).not.toBe('none');
    }
    first.dispose();
    second.dispose();
  });

  it('shows the current mode at once when created during Edit Mode and stops updating after dispose', () => {
    ViewportEditModeBadgeState.interactionModeSet(EditorInteractionMode.EDIT_MODE);
    ViewportEditModeBadgeState.componentModeSet(EditorComponentMode.FACE);
    const parent = document.createElement('div');
    const badge = new ViewportEditModeBadge(parent);
    expect(badge.getElement().textContent).toContain('FACE');
    badge.dispose();
    ViewportEditModeBadgeState.componentModeSet(EditorComponentMode.EDGE);
    expect(badge.getElement().textContent).toContain('FACE');
    expect(parent.contains(badge.getElement())).toBe(false);
  });
});
