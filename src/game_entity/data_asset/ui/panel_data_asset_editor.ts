import type { GameEntityAssetType } from '@/game_entity/class/game_entity_class_schema.js';
import {
  gameEntityDataAssetClassCreate,
  gameEntityDataAssetPathSuggest,
} from '@/game_entity/data_asset/game_entity_data_asset_class.js';
import { GameEntityDataAssetClient } from '@/game_entity/data_asset/game_entity_data_asset_client.js';
import { GameEntityDataAssetSession } from '@/game_entity/data_asset/game_entity_data_asset_session.js';
import { GameEntityComponentBlock } from '@/game_entity/ui/game_entity_component_block.js';
import { Theme } from '@/theme.js';
import { PanelFloating } from '@/ui/floating_panel/panel_floating.js';
import { applyFloatingPanelToolChrome } from '@/ui/floating_panel/panel_floating_tool_chrome.js';
import { styleFloatingPanelChromeButton } from '@/ui/floating_panel/panel_floating_title_bar.js';
import { InputText } from '@/ui/input/input_text.js';

/** Note shown under the fields. */
const PANEL_DATA_ASSET_NOTE = "Edits are written to the game's file right away and are not part of undo.";

/** Shown when no preview link can reach the game. */
const PANEL_DATA_ASSET_OFFLINE = 'Connect the game preview to edit data assets.';

/**
 * Floating window that edits one data asset file of the running game with the
 * same field editors as game components, or creates a new file.
 */
export class PanelDataAssetEditor extends PanelFloating {
  private static sharedPanel: PanelDataAssetEditor | null = null;
  private readonly headerLine: HTMLElement;
  private readonly createRow: HTMLElement;
  private readonly createPathInput: InputText;
  private readonly createButton: HTMLButtonElement;
  private readonly blockHost: HTMLElement;
  private readonly statusLine: HTMLElement;
  private readonly clientResolve: () => GameEntityDataAssetClient | null;
  private session: GameEntityDataAssetSession | null = null;
  private creation: { assetType: GameEntityAssetType; onCreated: (path: string) => void } | null = null;
  private pending: Promise<void> = Promise.resolve();

  /**
   * Creates the panel.
   *
   * @param host Parent element of the panel.
   * @param clientResolve Returns the client that reaches the game; the active
   *   preview link's client by default.
   */
  constructor(
    host: HTMLElement,
    clientResolve: () => GameEntityDataAssetClient | null = () => GameEntityDataAssetClient.activeRead(),
  ) {
    super(host, { corner: 'top-left', insetBelowViewportToolbar: true });
    this.clientResolve = clientResolve;
    this.headerLine = this.lineCreate();
    this.createPathInput = new InputText('Data asset path');
    this.createButton = this.buttonCreate('Create', 'Create the data asset file', () => this.creationFinish());
    this.createRow = this.createRowBuild();
    this.blockHost = document.createElement('div');
    this.statusLine = this.lineCreate();
    this.rootPopulate();
  }

  /**
   * Returns the panel every asset field opens, creating it on first use.
   *
   * @returns Shared panel mounted on the document body.
   */
  static shared(): PanelDataAssetEditor {
    PanelDataAssetEditor.sharedPanel ??= new PanelDataAssetEditor(document.body);
    return PanelDataAssetEditor.sharedPanel;
  }

  /**
   * Opens an existing data asset file for editing.
   *
   * @param assetType Asset type the file holds.
   * @param path Asset path of the file.
   * @returns Resolves once the file is shown or the failure is reported.
   */
  assetOpen(assetType: GameEntityAssetType, path: string): Promise<void> {
    this.creation = null;
    this.headerShow(assetType, path);
    return this.sessionLoad((client) => GameEntityDataAssetSession.open(assetType, path, client));
  }

  /**
   * Offers to create a new data asset file with a suggested path.
   *
   * @param assetType Asset type of the new file.
   * @param onCreated Receives the path once the file exists.
   */
  assetCreateBegin(assetType: GameEntityAssetType, onCreated: (path: string) => void): void {
    this.session = null;
    this.creation = { assetType, onCreated };
    this.headerShow(assetType, 'New file');
    this.createPathInput.setSharedValues([gameEntityDataAssetPathSuggest(assetType)]);
    this.blockHost.replaceChildren();
    this.statusShow('', false);
    this.show();
  }

  /**
   * Returns the path input of the create row.
   *
   * @returns Path input.
   */
  createPathInputRead(): HTMLInputElement {
    return this.createPathInput.getElement();
  }

  /**
   * Returns a promise that settles once the last read or write finished.
   *
   * @returns Pending work.
   */
  settled(): Promise<void> {
    return this.pending;
  }

  /** Closes the shared panel reference when the shared panel is disposed. */
  override dispose(): void {
    if (PanelDataAssetEditor.sharedPanel === this) {
      PanelDataAssetEditor.sharedPanel = null;
    }
    super.dispose();
  }

  /** Writes the new file named in the create row and opens it. */
  private creationFinish(): void {
    const creation = this.creation;
    if (!creation) {
      return;
    }
    const path = this.createPathInput.getValue().trim();
    void this.sessionLoad(async (client) => {
      const session = await GameEntityDataAssetSession.create(creation.assetType, path, client);
      this.creation = null;
      this.headerShow(creation.assetType, path);
      creation.onCreated(path);
      return session;
    });
  }

  /**
   * Runs a session load and shows its result.
   *
   * @param load Opens or creates the session with a client.
   * @returns Resolves once the result is shown.
   */
  private sessionLoad(load: (client: GameEntityDataAssetClient) => Promise<GameEntityDataAssetSession>): Promise<void> {
    this.show();
    const client = this.clientResolve();
    if (!client) {
      this.statusShow(PANEL_DATA_ASSET_OFFLINE, true);
      return Promise.resolve();
    }
    this.statusShow('Loading…', false);
    this.pending = load(client).then(
      (session) => this.sessionShow(session),
      (error: unknown) => this.statusShow(PanelDataAssetEditor.errorText(error), true),
    );
    return this.pending;
  }

  /**
   * Shows the fields of a session.
   *
   * @param session Open data asset.
   */
  private sessionShow(session: GameEntityDataAssetSession): void {
    this.session = session;
    this.createRow.style.display = this.creation ? 'flex' : 'none';
    const block = new GameEntityComponentBlock(
      session.assetType.type_path,
      [session.componentsRead()],
      (edit) => this.valuesWrite(session, edit),
      { gameClass: gameEntityDataAssetClassCreate(session.assetType), removable: false },
    );
    this.blockHost.replaceChildren(block.getElement());
    this.statusShow('', false);
  }

  /**
   * Writes an edit of the open file and shows the new values.
   *
   * @param session Session the edit belongs to.
   * @param edit Turns the current overrides into the new ones.
   */
  private valuesWrite(
    session: GameEntityDataAssetSession,
    edit: Parameters<GameEntityDataAssetSession['valuesEdit']>[0],
  ): void {
    this.statusShow('Saving…', false);
    this.pending = session.valuesEdit(edit).then(
      () => (this.session === session ? this.sessionShow(session) : undefined),
      (error: unknown) => this.statusShow(PanelDataAssetEditor.errorText(error), true),
    );
  }

  /**
   * Shows the asset type and path in the header line.
   *
   * @param assetType Asset type.
   * @param pathText Path or placeholder text.
   */
  private headerShow(assetType: GameEntityAssetType, pathText: string): void {
    this.headerLine.textContent = `${assetType.label}: ${pathText}`;
    this.headerLine.title = assetType.type_path;
    this.createRow.style.display = this.creation ? 'flex' : 'none';
  }

  /**
   * Shows a status message.
   *
   * @param text Message, empty to clear it.
   * @param isError True to paint it as an error.
   */
  private statusShow(text: string, isError: boolean): void {
    this.statusLine.textContent = text;
    this.statusLine.dataset['error'] = isError ? 'true' : 'false';
    this.statusLine.style.color = isError ? '#ff7a6a' : Theme.inputTextColor;
  }

  /** Fills the panel with its title bar, rows, fields, note and status. */
  private rootPopulate(): void {
    applyFloatingPanelToolChrome(this.root, { width: '320px', borderRadiusPx: 8 });
    this.root.setAttribute('aria-label', 'Data Asset');
    this.root.appendChild(this.createStandardTitleBar({ titleText: 'Data Asset' }).bar);
    this.blockHost.style.padding = '0 10px';
    const note = this.lineCreate();
    note.textContent = PANEL_DATA_ASSET_NOTE;
    note.style.opacity = '0.7';
    this.root.append(this.headerLine, this.createRow, this.blockHost, note, this.statusLine);
  }

  /**
   * Builds the row with the new file's path and the Create button.
   *
   * @returns Row element, hidden until a creation begins.
   */
  private createRowBuild(): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'none';
    row.style.gap = '6px';
    row.style.padding = '6px 10px 0';
    const input = this.createPathInput.getElement();
    input.style.flex = '1';
    input.style.minWidth = '0';
    row.append(input, this.createButton);
    return row;
  }

  /**
   * Creates a padded text line.
   *
   * @returns Line element.
   */
  private lineCreate(): HTMLElement {
    const line = document.createElement('div');
    line.style.padding = '6px 10px 0';
    line.style.fontSize = '11px';
    line.style.color = Theme.inputTextColor;
    line.style.wordBreak = 'break-all';
    return line;
  }

  /**
   * Creates a text button with the floating panel look.
   *
   * @param text Button text.
   * @param title Tooltip.
   * @param onClick Click handler.
   * @returns Button element.
   */
  private buttonCreate(text: string, title: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.title = title;
    styleFloatingPanelChromeButton(button);
    button.style.padding = '2px 8px';
    button.addEventListener('click', onClick);
    return button;
  }

  /**
   * Returns the text of a failure.
   *
   * @param error Thrown value.
   * @returns Message.
   */
  private static errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
