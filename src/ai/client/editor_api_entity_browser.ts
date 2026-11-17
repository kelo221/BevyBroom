import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import { vec3FromUnknown } from './editor_api_math.js';
import { EditorApiViewportPointer } from './editor_api_viewport_pointer.js';
import {
  EDITOR_API_VIEWPORT_VIEW_NAMES,
  editorApiViewportClientPointOf,
  editorApiVisibleViewportFind,
} from './editor_api_viewport_locate.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { ENTITY_BROWSER_TILE_ID_ATTRIBUTE } from '@/entity_browser/ui/entity_browser_tile.js';
import type { PointerClientPoint } from '@/utils/pointer_client_project.js';

/** One tile the entity browser shows. */
interface EditorApiEntityBrowserTile {
  /** Catalog id of the tile, such as "prefab.shelf_row" or "lights.point". */
  readonly id: string;
  /** Visible name. */
  readonly label: string;
  /** Category path. */
  readonly category: string;
  /** True for the selected tile. */
  readonly selected: boolean;
}

/** Message given when a tile is not on screen. */
const EDITOR_API_ENTITY_BROWSER_TILE_MISSING =
  'is not shown; open the Entity Browser (set_main_window floatingWindows.entity_browser) and clear its filters';

/**
 * Reads the Entity Browser's tiles and drags a tile into a view the way a user
 * does, through real pointer events on the tile and the view.
 */
export class EditorApiEntityBrowser {
  private readonly host: EditorApiHost;
  private readonly selectionResultRead: () => McpToolResult;
  private readonly ownerDocument: Document;

  /**
   * Creates the entity browser tools.
   *
   * @param host Editor host listing the interactive viewports.
   * @param selectionResultRead Reads the selection as a tool result.
   * @param ownerDocument Document the browser is shown in.
   */
  constructor(host: EditorApiHost, selectionResultRead: () => McpToolResult, ownerDocument: Document = document) {
    this.host = host;
    this.selectionResultRead = selectionResultRead;
    this.ownerDocument = ownerDocument;
  }

  /**
   * Runs an entity browser tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no entity browser tool.
   */
  entityBrowserToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    switch (name) {
      case 'get_entity_browser_tiles':
        return okResult('Entity Browser tiles', { tiles: this.tilesRead() });
      case 'entity_browser_drag':
        return this.tileDrag(args);
      default:
        return null;
    }
  }

  /**
   * Reads the tiles on screen in display order.
   *
   * @returns Tiles.
   */
  private tilesRead(): EditorApiEntityBrowserTile[] {
    const elements = this.ownerDocument.querySelectorAll<HTMLElement>(`[${ENTITY_BROWSER_TILE_ID_ATTRIBUTE}]`);
    return [...elements].map((element) => {
      const [label = '', category = ''] = element.title.split('\n');
      const id = element.getAttribute(ENTITY_BROWSER_TILE_ID_ATTRIBUTE) ?? '';
      return { id, label, category, selected: element.getAttribute('aria-selected') === 'true' };
    });
  }

  /**
   * Drags a tile from the browser and drops it on the point of a view where a
   * world point shows.
   *
   * @param args Tool arguments with tileId, view and at.
   * @returns Result with the selection after the drop, which holds what was
   *   placed, and the page text left selected by the drag.
   */
  private tileDrag(args: Record<string, unknown>): McpToolResult {
    const tileId = typeof args['tileId'] === 'string' ? args['tileId'] : '';
    const at = vec3FromUnknown(args['at']);
    const view = typeof args['view'] === 'string' ? args['view'] : '';
    if (at === null || !EDITOR_API_VIEWPORT_VIEW_NAMES.includes(view)) {
      return failResult(`at must be {x, y, z} and view one of ${EDITOR_API_VIEWPORT_VIEW_NAMES.join(', ')}`);
    }
    const tile = this.ownerDocument.querySelector<HTMLElement>(
      `[${ENTITY_BROWSER_TILE_ID_ATTRIBUTE}="${CSS.escape(tileId)}"]`,
    );
    const viewport = editorApiVisibleViewportFind(this.host, view);
    if (tile === null || viewport === null) {
      return failResult(
        tile === null ? `Tile ${tileId} ${EDITOR_API_ENTITY_BROWSER_TILE_MISSING}` : `No visible ${view} view`,
      );
    }
    const dropPoint = editorApiViewportClientPointOf(viewport, at);
    this.pointerDragSend(tile, viewport.getContentElement(), dropPoint);
    const selection = this.selectionResultRead().data;
    const pageSelectedText = this.ownerDocument.getSelection()?.toString() ?? '';
    return okResult(`Dragged ${tileId} into the ${view} view`, { selection, dropPoint, pageSelectedText });
  }

  /**
   * Presses the primary button on a tile, moves past the drag threshold onto a
   * drop point and releases there.
   *
   * @param tile Tile element.
   * @param dropElement Element under the drop point.
   * @param dropPoint Client point of the drop.
   */
  private pointerDragSend(tile: HTMLElement, dropElement: HTMLElement, dropPoint: PointerClientPoint): void {
    const tileRect = tile.getBoundingClientRect();
    const pressPoint = { clientX: tileRect.left + tileRect.width / 2, clientY: tileRect.top + tileRect.height / 2 };
    const noKeys = { ctrl: false, shift: false, alt: false };
    new EditorApiViewportPointer(tile, noKeys, 'left').press(pressPoint);
    const dropPointer = new EditorApiViewportPointer(dropElement, noKeys, 'left');
    dropPointer.dragTo(dropPoint);
    dropPointer.release(dropPoint);
  }
}
