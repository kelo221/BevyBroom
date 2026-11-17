import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import { ENTITY_BROWSER_DRAG_THRESHOLD_PX } from '@/entity_browser/drag/entity_browser_drag_session.js';
import { EntityBrowserSettingsStore } from '@/entity_browser/state/entity_browser_settings_store.js';
import { EntityBrowser, type EntityBrowserHost } from '@/entity_browser/ui/entity_browser.js';
import { ENTITY_BROWSER_TILE_ID_ATTRIBUTE } from '@/entity_browser/ui/entity_browser_tile.js';
import { MemorySettingsStorage } from '@/settings/storage/settings_storage.js';
import type { EntityBrowserPreviewRendererFactory } from '@/entity_browser/preview/entity_browser_preview_renderer.js';
import { ENTITY_BROWSER_THUMBNAIL_IMAGE_ATTRIBUTE } from '@/entity_browser/ui/entity_browser_thumbnail.js';
import {
  ENTITY_BROWSER_PREVIEW_PANE_MESSAGE_NO_PREVIEW,
  ENTITY_BROWSER_PREVIEW_PANE_MESSAGE_UNAVAILABLE,
} from '@/entity_browser/ui/entity_browser_preview_pane.js';
import {
  entityBrowserTestEditorCreate,
  entityBrowserTestPreviewRendererCreate,
  type EntityBrowserTestEditor,
} from '../entity_browser_test_support.js';

/** A mounted browser over a test editor, with its drop spy. */
interface MountedBrowser {
  readonly browser: EntityBrowser;
  readonly editor: EntityBrowserTestEditor;
  readonly entityPlace: ReturnType<typeof vi.fn<EntityBrowserHost['entityPlace']>>;
  readonly storage: MemorySettingsStorage;
}

/** Browsers mounted by the running test, disposed afterwards. */
const mountedBrowsers: EntityBrowser[] = [];

/**
 * Mounts a browser over a fresh test editor.
 *
 * @param storage Settings storage shared between browsers.
 * @param previewRendererFactory Creates the 3D preview renderer; none draws in
 *   3D when omitted.
 * @returns Mounted browser.
 */
function browserMount(
  storage: MemorySettingsStorage = new MemorySettingsStorage(),
  previewRendererFactory: EntityBrowserPreviewRendererFactory = () => null,
): MountedBrowser {
  const editor = entityBrowserTestEditorCreate();
  const entityPlace = vi.fn<EntityBrowserHost['entityPlace']>();
  const browser = new EntityBrowser({
    worldObject: editor.world,
    addMenuActions: editor.actions,
    entityPlace,
    settingsStore: new EntityBrowserSettingsStore(storage),
    ownerDocument: document,
    previewRendererFactory,
  });
  document.body.appendChild(browser.getElement());
  mountedBrowsers.push(browser);
  return { browser, editor, entityPlace, storage };
}

/**
 * Returns the tile element of an entry and fails when it is not shown.
 *
 * @param browser Browser.
 * @param entryId Entry id.
 * @returns Tile element.
 */
function tileFind(browser: EntityBrowser, entryId: string): HTMLElement {
  const tile = browser.getElement().querySelector<HTMLElement>(`[${ENTITY_BROWSER_TILE_ID_ATTRIBUTE}="${entryId}"]`);
  if (!tile) throw new Error(`tile ${entryId} is not shown`);
  return tile;
}

/**
 * Returns the ids of the shown tiles.
 *
 * @param browser Browser.
 * @returns Entry ids in display order.
 */
function shownIds(browser: EntityBrowser): string[] {
  return browser.shownEntriesList().map((entry: EntityBrowserCatalogEntry) => entry.id);
}

/**
 * Returns the controls button with a label.
 *
 * @param browser Browser.
 * @param label Button text.
 * @returns Button.
 */
function controlButton(browser: EntityBrowser, label: string): HTMLButtonElement {
  const buttons = [...browser.getElement().querySelectorAll('button')];
  const button = buttons.find((candidate) => candidate.textContent === label);
  if (!button) throw new Error(`missing ${label} button`);
  return button;
}

/**
 * Returns the controls dropdown offering a value.
 *
 * @param browser Browser.
 * @param optionValue Value one of its options carries.
 * @returns Select element.
 */
function controlSelect(browser: EntityBrowser, optionValue: string): HTMLSelectElement {
  const selects = [...browser.getElement().querySelectorAll('select')];
  const select = selects.find((candidate) => [...candidate.options].some((option) => option.value === optionValue));
  if (!select) throw new Error(`missing dropdown offering ${optionValue}`);
  return select;
}

/**
 * Picks a value in a dropdown the way a user does.
 *
 * @param select Select element.
 * @param value Value to pick.
 */
function selectPick(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Gives an element a layout size, which the test document does not compute.
 *
 * @param element Element.
 * @param widthPx Width in CSS pixels.
 * @param heightPx Height in CSS pixels.
 */
function elementSizeSet(element: HTMLElement, widthPx: number, heightPx: number): void {
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: widthPx });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: heightPx });
}

/**
 * Dispatches a pointer event with client coordinates.
 *
 * @param target Event target.
 * @param type Event type.
 * @param clientX Client X.
 * @param clientY Client Y.
 */
function pointerDispatch(target: EventTarget, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
}

/**
 * Drags a tile from its press point to a release target.
 *
 * @param tile Pressed tile.
 * @param releaseTarget Element under the pointer on release.
 * @param releasePoint Release client point.
 */
function tileDrag(tile: HTMLElement, releaseTarget: EventTarget, releasePoint: { x: number; y: number }): void {
  pointerDispatch(tile, 'pointerdown', 10, 10);
  pointerDispatch(document, 'pointermove', 10 + ENTITY_BROWSER_DRAG_THRESHOLD_PX * 3, 10);
  pointerDispatch(releaseTarget, 'pointerup', releasePoint.x, releasePoint.y);
}

/**
 * The entity browser shows every Add menu kind as a tile, adds kinds on
 * double-click or Enter, places them by drag and drop and remembers its display
 * choices.
 */
describe('EntityBrowser', () => {
  afterEach(() => {
    mountedBrowsers.splice(0).forEach((browser) => browser.dispose());
    document.body.replaceChildren();
  });

  it('adds the double-clicked kind through its Add action', () => {
    const { browser, editor } = browserMount();
    tileFind(browser, 'lights.point').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(editor.world.children).toHaveLength(1);
    browser.usageRefresh();
    expect(tileFind(browser, 'lights.point').title).toContain('Used 1 time');
  });

  it('selects a clicked tile in orange and adds the selection on Enter', () => {
    const { browser, editor } = browserMount();
    const tile = tileFind(browser, 'geometry.box');
    tile.click();
    expect(tile.getAttribute('aria-selected')).toBe('true');
    tileFind(browser, 'geometry.sphere').click();
    expect(tile.getAttribute('aria-selected')).toBe('false');
    const grid = tile.closest('[role="listbox"]');
    grid?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(editor.world.children).toHaveLength(1);
  });

  it('groups tiles under category headers only while Group is on', () => {
    const { browser } = browserMount();
    browser.optionsUpdate({ groupByCategory: false });
    const headersWhenFlat = browser.getElement().textContent ?? '';
    controlButton(browser, 'Group').click();
    expect(browser.optionsRead().groupByCategory).toBe(true);
    expect(controlButton(browser, 'Group').getAttribute('aria-pressed')).toBe('true');
    expect(browser.getElement().textContent ?? '').toContain('Lights');
    expect(headersWhenFlat).not.toContain('Lights');
  });

  it('shows only kinds the map uses while Used is on', () => {
    const { browser } = browserMount();
    tileFind(browser, 'portals.room').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    browser.usageRefresh();
    controlButton(browser, 'Used').click();
    expect(shownIds(browser)).toEqual(['portals.room']);
    controlButton(browser, 'Used').click();
    expect(shownIds(browser).length).toBeGreaterThan(1);
  });

  it('filters tiles by the search field while typing', () => {
    const { browser } = browserMount();
    const search = browser.getElement().querySelector<HTMLInputElement>('input[type="text"]');
    if (!search) throw new Error('missing search field');
    search.value = 'LIGHT';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(shownIds(browser).sort()).toEqual(['lights.point', 'lights.spot']);
  });

  it('sorts by name when chosen in the sort dropdown', () => {
    const { browser } = browserMount();
    browser.optionsUpdate({ groupByCategory: false });
    selectPick(controlSelect(browser, 'name'), 'name');
    const labels = browser.shownEntriesList().map((entry) => entry.label.toLowerCase());
    expect(labels).toEqual([...labels].sort((first, second) => first.localeCompare(second)));
  });

  it('restores the display choices in a new browser', () => {
    const first = browserMount();
    first.browser.optionsUpdate({ sortMode: 'name', groupByCategory: false, usedOnly: true, searchText: 'cube' });
    const second = browserMount(first.storage);
    expect(second.browser.optionsRead()).toEqual(first.browser.optionsRead());
    const search = second.browser.getElement().querySelector<HTMLInputElement>('input[type="text"]');
    expect(search?.value).toBe('cube');
    expect(controlButton(second.browser, 'Used').getAttribute('aria-pressed')).toBe('true');
  });

  it('asks the host to place a tile dropped outside the browser at the drop point', () => {
    const { browser, entityPlace } = browserMount();
    const viewport = document.createElement('div');
    document.body.appendChild(viewport);
    tileDrag(tileFind(browser, 'lights.spot'), viewport, { x: 300, y: 200 });
    expect(entityPlace).toHaveBeenCalledTimes(1);
    expect(entityPlace.mock.calls[0]?.[0].id).toBe('lights.spot');
    expect(entityPlace.mock.calls[0]?.slice(1)).toEqual([300, 200]);
    expect(document.querySelector('[data-entity-browser-drag-ghost]')).toBeNull();
  });

  it('shows a ghost while dragging and places nothing when released over the browser or cancelled', () => {
    const { browser, entityPlace } = browserMount();
    const tile = tileFind(browser, 'lights.spot');
    tileDrag(tile, tile, { x: 5, y: 5 });
    pointerDispatch(tile, 'pointerdown', 10, 10);
    pointerDispatch(document, 'pointermove', 60, 60);
    expect(document.querySelector('[data-entity-browser-drag-ghost]')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('[data-entity-browser-drag-ghost]')).toBeNull();
    pointerDispatch(document.body, 'pointerup', 300, 200);
    expect(entityPlace).not.toHaveBeenCalled();
  });

  it('places nothing for a press released before the drag threshold', () => {
    const { browser, entityPlace } = browserMount();
    const tile = tileFind(browser, 'lights.spot');
    pointerDispatch(tile, 'pointerdown', 10, 10);
    pointerDispatch(document.body, 'pointerup', 11, 10);
    expect(entityPlace).not.toHaveBeenCalled();
  });

  it("shows each kind's rendered 3D meshes on its tile in the 3D Tiles view and icons in the Icons view", () => {
    const renderer = entityBrowserTestPreviewRendererCreate();
    const { browser } = browserMount(undefined, () => renderer);
    const imageSelector = `[${ENTITY_BROWSER_THUMBNAIL_IMAGE_ATTRIBUTE}]`;
    selectPick(controlSelect(browser, 'tiles_3d'), 'tiles_3d');
    for (const entryId of ['geometry.box', 'lights.point', 'portals.room', 'game_entity.empty']) {
      expect(tileFind(browser, entryId).querySelector(imageSelector)).not.toBeNull();
    }
    expect(tileFind(browser, 'terrain.terrain').querySelector(imageSelector)).toBeNull();
    selectPick(controlSelect(browser, 'icons'), 'icons');
    expect(browser.getElement().querySelector(imageSelector)).toBeNull();
    const imagesDrawn = renderer.renderToImageUrl.mock.calls.length;
    selectPick(controlSelect(browser, 'tiles_3d'), 'tiles_3d');
    expect(renderer.renderToImageUrl.mock.calls.length).toBe(imagesDrawn);
  });

  it('shows one large orbitable 3D tile of the selected kind above the grid in the 1 Tile 3D view', () => {
    const renderer = entityBrowserTestPreviewRendererCreate();
    const { browser } = browserMount(undefined, () => renderer);
    const pane = browser.previewPaneRead();
    elementSizeSet(pane.element, 320, 200);
    selectPick(controlSelect(browser, 'single_3d'), 'single_3d');
    expect(pane.element.isConnected).toBe(true);
    expect(pane.element.nextElementSibling?.getAttribute('role')).toBe('listbox');
    expect(pane.element.contains(renderer.canvas)).toBe(true);
    expect(pane.entryRead()?.id).toBe(browser.shownEntriesList()[0]?.id);
    tileFind(browser, 'lights.spot').click();
    expect(pane.entryRead()?.id).toBe('lights.spot');
    expect(pane.element.textContent).toContain('Spot Light');
    expect(renderer.renderToCanvas).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 320, 200);
    const yawBefore = pane.orbit.yaw;
    const drawsBefore = renderer.renderToCanvas.mock.calls.length;
    pane.element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0, pointerId: 7 }));
    pane.element.dispatchEvent(new PointerEvent('pointermove', { clientX: 60, clientY: 10, pointerId: 7 }));
    expect(pane.orbit.yaw).not.toBe(yawBefore);
    expect(renderer.renderToCanvas.mock.calls.length).toBeGreaterThan(drawsBefore);
    selectPick(controlSelect(browser, 'icons'), 'icons');
    expect(pane.element.isConnected).toBe(false);
  });

  it('says so in the 1 Tile 3D view when a kind has no meshes or 3D drawing is unavailable', () => {
    const renderer = entityBrowserTestPreviewRendererCreate();
    const drawing = browserMount(undefined, () => renderer).browser;
    elementSizeSet(drawing.previewPaneRead().element, 320, 200);
    drawing.optionsUpdate({ viewMode: 'single_3d' });
    drawing.selectedEntrySet('terrain.terrain');
    expect(drawing.previewPaneRead().messageRead()).toBe(ENTITY_BROWSER_PREVIEW_PANE_MESSAGE_NO_PREVIEW);
    drawing.selectedEntrySet('geometry.box');
    expect(drawing.previewPaneRead().messageRead()).toBe('');
    const without3d = browserMount().browser;
    without3d.optionsUpdate({ viewMode: 'single_3d' });
    expect(without3d.previewPaneRead().messageRead()).toBe(ENTITY_BROWSER_PREVIEW_PANE_MESSAGE_UNAVAILABLE);
  });

  it('frees the 3D renderer when disposed', () => {
    const renderer = entityBrowserTestPreviewRendererCreate();
    const { browser } = browserMount(undefined, () => renderer);
    browser.optionsUpdate({ viewMode: 'tiles_3d' });
    browser.dispose();
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });
});
