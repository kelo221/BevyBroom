import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewportToolEntityPlaceControls } from '@/tools/chrome/options/viewport_tool_entity_place_controls.js';
import {
  getStateEntityPlace,
  setStateEntityPlaceForTests,
  StateEntityPlace,
} from '@/tools/entity_place/state_entity_place.js';

/** Controls built by the running test. */
const entityPlaceControlsTestControls: ViewportToolEntityPlaceControls[] = [];

/**
 * Builds the Entity tool option controls mounted in the document.
 *
 * @returns Controls.
 */
function entityPlaceControlsTestCreate(): ViewportToolEntityPlaceControls {
  const controls = new ViewportToolEntityPlaceControls(document);
  document.body.appendChild(controls.entityElementRead());
  entityPlaceControlsTestControls.push(controls);
  return controls;
}

beforeEach(() => {
  setStateEntityPlaceForTests(new StateEntityPlace());
});

afterEach(() => {
  entityPlaceControlsTestControls.splice(0).forEach((controls) => controls.dispose());
  setStateEntityPlaceForTests(null);
  document.body.replaceChildren();
});

describe('ViewportToolEntityPlaceControls', () => {
  it('shows a Browse button beside the Entity class list', () => {
    const controls = entityPlaceControlsTestCreate();
    const browseButton = controls.entityElementRead().querySelector('.viewport-tool-entity-place-browse');
    expect(browseButton?.textContent).toBe('Browse…');
    expect(controls.entityElementRead().querySelector('.viewport-tool-entity-place-select')).not.toBeNull();
  });

  it('opens the entity browser through the Entity tool browse delegate', () => {
    const controls = entityPlaceControlsTestCreate();
    const browseDelegate = vi.fn();
    getStateEntityPlace().browseDelegateWrite(browseDelegate);
    controls.entityElementRead().querySelector<HTMLElement>('.viewport-tool-entity-place-browse')?.click();
    expect(browseDelegate).toHaveBeenCalledOnce();
  });
});
