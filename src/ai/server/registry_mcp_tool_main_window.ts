import { emptySchema, tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/**
 * Tools that read and change which docks, tabs and bars of the main window are
 * shown, and open, apply and cancel its Object Properties dialog.
 */
export const MCP_MAIN_WINDOW_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'get_main_window',
    'The main window arrangement: inspectorVisible, infoPanelVisible, infoPanelCollapsed (folded to its one-line strip) and infoPanelTab (console or issues), toolbarVisible, the menu bar titles in order, menuBarInWindow (false once the menus moved into the native macOS menu bar), themeLook (classic or mac_glass), and floatingWindows (texture_browser, entity_browser) as true while shown.',
    emptySchema(),
  ),
  tool(
    'set_main_window',
    'Show or hide the inspector, info panel and toolbar, fold or unfold the info panel, switch the info panel tab, and show or hide floating windows. Omitted fields stay as they are. Returns the new arrangement like get_main_window.',
    {
      type: 'object',
      properties: {
        inspectorVisible: { type: 'boolean', description: 'Show or hide the inspector on the right.' },
        infoPanelTab: { type: 'string', enum: ['console', 'issues'], description: 'Info panel tab to show.' },
        infoPanelVisible: { type: 'boolean', description: 'Show or hide the info panel below the views.' },
        infoPanelCollapsed: {
          type: 'boolean',
          description:
            'Fold the info panel to its one-line strip (true) or unfold it to its remembered height (false).',
        },
        toolbarVisible: { type: 'boolean', description: 'Show or hide the icon toolbar.' },
        floatingWindows: {
          type: 'object',
          description:
            'Show or hide floating windows by id (texture_browser, entity_browser). True shows, false hides. Omitted ids stay as they are.',
          properties: {
            texture_browser: { type: 'boolean' },
            entity_browser: { type: 'boolean' },
          },
        },
      },
    },
  ),
  tool(
    'get_shell_layout',
    'Read-only screen rectangles ({x, y, width, height} in CSS pixels) of the main window areas: views (map views above the info panel), infoPanel (Console / Issues panel) and inspector (right dock). Hidden areas are zero sized.',
    emptySchema(),
  ),
  tool(
    'get_object_properties_dialog',
    'The Object Properties dialog: open, the visible tab, the tab ids in order (class_info, outputs, inputs, properties, visgroup, ...) and the ids of the objects it edits.',
    emptySchema(),
  ),
  tool(
    'set_object_properties_dialog',
    'Open the Object Properties dialog on the selection (like Alt+Enter), Apply its edits as one undo step or Cancel them, switch its tab, and optionally write comments as a session edit. Returns the state like get_object_properties_dialog.',
    {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['open', 'apply', 'cancel'],
          description:
            'open needs a selection; apply keeps the edits as one undo step; cancel restores the state from before opening.',
        },
        tab: { type: 'string', description: 'Tab id to show, from get_object_properties_dialog.' },
        comments: {
          type: 'string',
          description:
            'Designer comments written onto every edited object as a session edit. Needs the dialog open. Apply keeps them; Cancel discards them.',
        },
      },
    },
  ),
  tool(
    'set_object_class',
    'Convert objects in place to another class (undoable on the editor stack, not the Object Properties session). Each object keeps its id, name, transform, layers, VisGroups, comments and outputs. class is a label, class id or game type path from the Class combo. Returns classId, classLabel and ids.',
    {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Object ids (uuids) to convert.',
        },
        class: {
          type: 'string',
          description: 'Class label, class id (for example lights.point) or game type path.',
        },
      },
      required: ['ids', 'class'],
    },
  ),
];
