import { afterEach, describe, expect, it } from 'vitest';
import { EditorApi } from '@/ai/client/editor_api.js';
import { PanelOutliner } from '@/outliner/ui/panel_outliner.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';

/** Panels mounted by a test, disposed after it. */
const mountedPanels: PanelOutliner[] = [];

/** Selection part of an outliner_click reply. */
interface OutlinerClickTestReply {
  selection: { solidModelIds: string[] };
  pageSelectedText: string;
}

/**
 * Builds an EditorApi and a shown outliner over the same world and selection,
 * holding a number of solid models.
 *
 * @param modelCount Number of solid models to create.
 * @returns The api, the created solid model ids in outliner order and the
 *   outliner panel.
 */
function outlinerRigCreate(modelCount: number): { api: EditorApi; modelIds: string[]; panel: PanelOutliner } {
  const { host } = editorApiTestHostCreate();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const panel = new PanelOutliner(container, host.selectionManager, host.worldObject);
  mountedPanels.push(panel);
  const api = new EditorApi({ ...host, refreshOutliner: () => panel.refresh() });
  const modelIds = Array.from({ length: modelCount }, (_, index) => {
    const created = api.invokeTool('create_solid_model', { name: `OutlinerModel${index}` });
    return String((created.data as { modelId: string }).modelId);
  });
  panel.refresh();
  return { api, modelIds, panel };
}

/**
 * Clicks an outliner row through the tool and returns its reply.
 *
 * @param api Editor api.
 * @param id Row object id.
 * @param keys Held modifier keys.
 * @returns Selection and selected page text after the click.
 */
function outlinerClick(
  api: EditorApi,
  id: string,
  keys: { shift?: boolean; ctrl?: boolean } = {},
): OutlinerClickTestReply {
  const result = api.invokeTool('outliner_click', { id, ...keys });
  expect(result.ok).toBe(true);
  return result.data as OutlinerClickTestReply;
}

/**
 * The outliner_click tool clicks outliner rows like a user with Shift or Ctrl
 * held.
 */
describe('EditorApi outliner_click', () => {
  afterEach(() => {
    mountedPanels.splice(0).forEach((panel) => panel.dispose());
    document.body.replaceChildren();
  });

  it('selects the range between a plain click and a Shift click in both directions', () => {
    const { api, modelIds } = outlinerRigCreate(5);
    outlinerClick(api, modelIds[1] ?? '');
    const down = outlinerClick(api, modelIds[3] ?? '', { shift: true });
    expect(new Set(down.selection.solidModelIds)).toEqual(new Set(modelIds.slice(1, 4)));
    expect(down.pageSelectedText).toBe('');
    outlinerClick(api, modelIds[4] ?? '');
    const up = outlinerClick(api, modelIds[2] ?? '', { shift: true });
    expect(new Set(up.selection.solidModelIds)).toEqual(new Set(modelIds.slice(2, 5)));
  });

  it('toggles a row with Ctrl and fails for an id no row shows', () => {
    const { api, modelIds } = outlinerRigCreate(3);
    outlinerClick(api, modelIds[0] ?? '');
    const toggled = outlinerClick(api, modelIds[2] ?? '', { ctrl: true });
    expect(new Set(toggled.selection.solidModelIds)).toEqual(new Set([modelIds[0], modelIds[2]]));
    expect(api.invokeTool('outliner_click', { id: 'missing-object' }).ok).toBe(false);
  });
});
