import type { EditorApiHost, EditorApiPropertiesSectionControl } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';

/** Properties section state the tools report. */
interface EditorApiPropertiesSectionState {
  tab: string | null;
  tabs: string[];
  editedIds: string[];
}

/**
 * MCP tools for the Properties section of the right dock: read which objects
 * and tabs it shows, switch its tab, and write comments as one undo step.
 */
export class EditorApiPropertiesSection {
  private readonly host: EditorApiHost;

  /**
   * Creates the tools over the editor host.
   *
   * @param host Editor host.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Runs a Properties section tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null for other tools.
   */
  propertiesSectionToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    switch (name) {
      case 'get_properties_section':
        return this.withSection((section) => okResult('Properties section', this.stateRead(section)));
      case 'set_properties_section':
        return this.withSection((section) => this.sectionSet(section, args));
      default:
        return null;
    }
  }

  /**
   * Reveals the section, switches its tab and writes comments.
   *
   * @param section Section control.
   * @param args Tool arguments with tab and comments.
   * @returns Tool result with the new state.
   */
  private sectionSet(section: EditorApiPropertiesSectionControl, args: Record<string, unknown>): McpToolResult {
    const problem = this.argumentsProblemRead(section, args);
    if (problem !== null) {
      return failResult(problem);
    }
    section.reveal();
    if (typeof args['tab'] === 'string') {
      section.tabShow(args['tab']);
    }
    const comments = args['comments'];
    const isChanged = typeof comments === 'string' && section.commentsWrite(comments);
    return okResult(isChanged ? 'Properties comments written' : 'Properties section shown', this.stateRead(section));
  }

  /**
   * Returns what is wrong with the arguments, if anything.
   *
   * @param section Section control.
   * @param args Tool arguments.
   * @returns Problem description, or null when valid.
   */
  private argumentsProblemRead(
    section: EditorApiPropertiesSectionControl,
    args: Record<string, unknown>,
  ): string | null {
    const tab = args['tab'];
    if (tab !== undefined && (typeof tab !== 'string' || !section.tabIdsRead().includes(tab))) {
      return `tab must be one of ${section.tabIdsRead().join(', ')}`;
    }
    const comments = args['comments'];
    if (comments !== undefined && typeof comments !== 'string') {
      return 'comments must be a string';
    }
    if (comments !== undefined && section.editedObjectsRead().length === 0) {
      return 'Select an object before setting comments';
    }
    return null;
  }

  /**
   * Reads the section state.
   *
   * @param section Section control.
   * @returns Shown tab, tabs and edited object ids.
   */
  private stateRead(section: EditorApiPropertiesSectionControl): EditorApiPropertiesSectionState {
    return {
      tab: section.tabActiveRead(),
      tabs: section.tabIdsRead(),
      editedIds: section.editedObjectsRead().map((object) => object.uuid),
    };
  }

  /**
   * Runs a tool body with the section, or fails when the editor has none.
   *
   * @param body Tool body.
   * @returns Tool result.
   */
  private withSection(body: (section: EditorApiPropertiesSectionControl) => McpToolResult): McpToolResult {
    const section = this.host.objectPropertiesSectionRead?.() ?? null;
    return section === null ? failResult('The editor has no Properties section') : body(section);
  }
}
