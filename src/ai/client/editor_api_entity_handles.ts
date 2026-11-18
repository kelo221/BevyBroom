import * as THREE from 'three';
import type { EditorApiHost, EditorApiViewportView } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { entityHandleArrowTipWorld } from '@/entity/handles/entity_handle_axis.js';
import { entityHandleArrowsOnScreen } from '@/entity/handles/entity_handle_picker.js';
import { entityHandleTargetsOfOwner } from '@/entity/handles/entity_handle_targets.js';
import type { EntityHandleTarget } from '@/entity/handles/entity_handle_drag_session.js';

/** World point as tools report it. */
interface EditorApiEntityHandlePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** One move arrow of a handle in a view. */
interface EditorApiEntityHandleArrow {
  /** Unit world direction. */
  readonly direction: EditorApiEntityHandlePoint;
  /** World point of the arrow tip in that view. */
  readonly tip: EditorApiEntityHandlePoint;
}

/** One handle of an entity in a view. */
interface EditorApiEntityHandle {
  /** Handle name. */
  readonly name: string;
  /** World position of the handle ball. */
  readonly position: EditorApiEntityHandlePoint;
  /**
   * Arrows the view shows and lets the user grab; arrows looking into the view
   * are left out.
   */
  readonly arrows: EditorApiEntityHandleArrow[];
}

/**
 * Reads the handles of an entity as a view shows them: ball positions and the
 * move arrows the user can grab there, so tools can drag them like a user.
 */
export class EditorApiEntityHandles {
  private readonly host: EditorApiHost;
  private readonly viewportFind: (view: string) => EditorApiViewportView | null;

  /**
   * Creates the entity handle tools.
   *
   * @param host Editor host holding the world.
   * @param viewportFind Returns the visible view of a kind.
   */
  constructor(host: EditorApiHost, viewportFind: (view: string) => EditorApiViewportView | null) {
    this.host = host;
    this.viewportFind = viewportFind;
  }

  /**
   * Runs an entity handle tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no entity handle tool.
   */
  entityHandlesToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    return name === 'get_entity_handles' ? this.handlesRead(args) : null;
  }

  /**
   * Reads the handles of one entity in one view.
   *
   * @param args Tool arguments with id and view.
   * @returns Result with the handles.
   */
  private handlesRead(args: Record<string, unknown>): McpToolResult {
    const id = typeof args['id'] === 'string' ? args['id'] : '';
    const view = typeof args['view'] === 'string' ? args['view'] : '';
    const owner = this.host.worldObject.getObjectByProperty('uuid', id);
    const viewport = this.viewportFind(view);
    if (!owner || viewport === null) {
      return failResult(owner ? `No visible ${view} view` : `No entity ${id}`);
    }
    const handles = entityHandleTargetsOfOwner(owner).map((target) => this.handleDescribe(target, viewport));
    return okResult(`${handles.length} handles of ${owner.name}`, { handles });
  }

  /**
   * Describes one handle as a view shows it.
   *
   * @param target Handle target.
   * @param viewport View.
   * @returns Handle description.
   */
  private handleDescribe(target: EntityHandleTarget, viewport: EditorApiViewportView): EditorApiEntityHandle {
    const camera = viewport.getCamera();
    const element = viewport.getContentElement();
    const settings = target.entityOwner.settingsRead(target.owner) ?? {};
    const position = target.handle.worldPositionFor({ owner: target.owner, camera }, settings);
    const paneHeight = element.getBoundingClientRect().height;
    const arrows = entityHandleArrowsOnScreen(target, { camera, element }).map((arrow) => ({
      direction: EditorApiEntityHandles.pointOf(arrow.axis),
      tip: EditorApiEntityHandles.pointOf(entityHandleArrowTipWorld(camera, position, arrow.axis, paneHeight)),
    }));
    return { name: target.handle.handleName, position: EditorApiEntityHandles.pointOf(position), arrows };
  }

  /**
   * Converts a vector to a plain point.
   *
   * @param vector Vector.
   * @returns Point.
   */
  private static pointOf(vector: THREE.Vector3): EditorApiEntityHandlePoint {
    return { x: vector.x, y: vector.y, z: vector.z };
  }
}
