import { afterEach, describe, expect, it } from 'vitest';
import type { GameEntityDataAssetClient } from '@/game_entity/data_asset/game_entity_data_asset_client.js';
import { PanelDataAssetEditor } from '@/game_entity/data_asset/ui/panel_data_asset_editor.js';
import { testDataAssetGameCreate, testDoorStatsAssetType } from '../game_entity_data_asset_test_support.js';

/**
 * The data asset panel shows a file's fields with the component editors, writes
 * every edit to the game, creates new files and explains when the game cannot
 * be reached.
 */
describe('PanelDataAssetEditor', () => {
  const panels: PanelDataAssetEditor[] = [];

  afterEach(() => {
    panels.splice(0).forEach((panel) => panel.dispose());
    document.body.replaceChildren();
  });

  /**
   * Creates a panel on the document body with a fixed client.
   *
   * @param client Client the panel uses, or null for an offline game.
   * @returns Panel.
   */
  function panelCreate(client: GameEntityDataAssetClient | null): PanelDataAssetEditor {
    const panel = new PanelDataAssetEditor(document.body, () => client);
    panels.push(panel);
    return panel;
  }

  /**
   * Returns the row of a field.
   *
   * @param panel Panel showing a file.
   * @param path Field path.
   * @returns Row element.
   */
  function fieldRow(panel: PanelDataAssetEditor, path: string): HTMLElement {
    const row = panel.getRootElement().querySelector<HTMLElement>(`[data-field-path="${path}"]`);
    if (!row) {
      throw new Error(`the panel shows field ${path}`);
    }
    return row;
  }

  it('shows the fields of a file with its overrides highlighted and no remove button', async () => {
    const { client } = testDataAssetGameCreate();
    const assetType = testDoorStatsAssetType();
    const [overridden, defaulted] = assetType.fields ?? [];
    const panel = panelCreate(client);
    await panel.assetOpen(assetType, assetType.paths[0] ?? '');
    expect(panel.isOpen()).toBe(true);
    expect(fieldRow(panel, overridden?.path ?? '').dataset['overridden']).toBe('true');
    expect(fieldRow(panel, defaulted?.path ?? '').dataset['overridden']).toBe('false');
    expect(panel.getRootElement().querySelector(`[aria-label^="Remove"]`)).toBeNull();
  });

  it('writes an edited field to the game file', async () => {
    const { transport, client } = testDataAssetGameCreate();
    const assetType = testDoorStatsAssetType();
    const path = assetType.paths[0] ?? '';
    const field = assetType.fields?.[1];
    const panel = panelCreate(client);
    await panel.assetOpen(assetType, path);
    const input = fieldRow(panel, field?.path ?? '').querySelector('input');
    if (!input) {
      throw new Error('the field has an input');
    }
    const value = Number(field?.default) + 2;
    input.value = String(value);
    input.dispatchEvent(new Event('change'));
    await panel.settled();
    expect((transport.dataAssetFiles.get(path)?.values as Record<string, unknown>)[field?.path ?? '']).toBe(value);
    expect(fieldRow(panel, field?.path ?? '').dataset['overridden']).toBe('true');
  });

  it('creates a new file at the chosen path and reports it', async () => {
    const { transport, client } = testDataAssetGameCreate();
    const assetType = testDoorStatsAssetType();
    const panel = panelCreate(client);
    const created: string[] = [];
    panel.assetCreateBegin(assetType, (path) => created.push(path));
    const pathInput = panel.createPathInputRead();
    expect(pathInput.value.endsWith(`.${assetType.extensions[0] ?? ''}`)).toBe(true);
    const path = `data/created.${assetType.extensions[0] ?? ''}`;
    pathInput.value = path;
    panel.getRootElement().querySelector<HTMLButtonElement>('button[title="Create the data asset file"]')?.click();
    await panel.settled();
    expect(created).toEqual([path]);
    expect(transport.dataAssetFiles.get(path)?.type_path).toBe(assetType.type_path);
    expect(panel.getRootElement().querySelector(`[data-field-path]`)).not.toBeNull();
  });

  it('explains that the game must be connected when no client exists', async () => {
    const assetType = testDoorStatsAssetType();
    const panel = panelCreate(null);
    await panel.assetOpen(assetType, assetType.paths[0] ?? '');
    expect(panel.getRootElement().querySelector('[data-error="true"]')?.textContent).toContain('Connect');
  });

  it('reports a file the game cannot read', async () => {
    const { client } = testDataAssetGameCreate();
    const panel = panelCreate(client);
    await panel.assetOpen(testDoorStatsAssetType(), 'missing/file.door.ron');
    expect(panel.getRootElement().querySelector('[data-error="true"]')?.textContent).toContain('missing/file.door.ron');
  });
});
