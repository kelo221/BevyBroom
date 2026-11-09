import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewportToolEntityPlaceControls } from '@/tools/chrome/options/viewport_tool_entity_place_controls.js';
import {
  getStateEntityPlace,
  setStateEntityPlaceForTests,
  StateEntityPlace,
} from '@/tools/entity_place/state_entity_place.js';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import {
  INPUT_WHEEL_TEST_NOTCH_DOWN,
  INPUT_WHEEL_TEST_NOTCH_UP,
  inputWheelTestDispatch,
} from '../../../ui/input/wheel/input_wheel_test_support.js';

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

/**
 * Builds a placeable catalog entry.
 *
 * @param id Entry id, also used as its label.
 * @returns Catalog entry.
 */
function entityPlaceControlsTestEntryCreate(id: string): EntityBrowserCatalogEntry {
  return {
    id,
    label: id,
    category: 'Test',
    categoryIndex: 0,
    catalogIndex: 0,
    iconName: null,
    iconColor: null,
    tooltip: id,
    objectMatches: null,
    activate: vi.fn(),
  };
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

  it('activates the next and previous entity class with the wheel over the list', () => {
    const entryIds = ['test_first', 'test_second', 'test_third'];
    getStateEntityPlace().entriesWrite(entryIds.map(entityPlaceControlsTestEntryCreate));
    const controls = entityPlaceControlsTestCreate();
    const select = controls.entityElementRead().querySelector<HTMLSelectElement>('.viewport-tool-entity-place-select');
    if (!select) throw new Error('entity list missing');
    inputWheelTestDispatch(select, INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(getStateEntityPlace().activeEntryRead()?.id).toBe(entryIds[1]);
    inputWheelTestDispatch(select, INPUT_WHEEL_TEST_NOTCH_UP);
    expect(getStateEntityPlace().activeEntryRead()?.id).toBe(entryIds[0]);
  });
});
