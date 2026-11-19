import { emptySchema, tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';
import { SHELL_FLOATING_WINDOW_IDS } from '@/layout/shell/actions/shell_floating_window.js';

/** Floating window ids as listed in tool descriptions. */
const MCP_MAIN_WINDOW_FLOATING_WINDOW_LIST = SHELL_FLOATING_WINDOW_IDS.join(', ');

/** One boolean property per floating window id. */
const MCP_MAIN_WINDOW_FLOATING_WINDOW_PROPERTIES = Object.fromEntries(
  SHELL_FLOATING_WINDOW_IDS.map((windowId) => [windowId, { type: 'boolean' }]),
);

/**
 * Tools that read and change which docks, tabs and bars of the main window are
 * shown, and open, apply and cancel its Object Properties dialog.
 */
export const MCP_MAIN_WINDOW_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'get_main_window',
    `The main window arrangement: inspectorVisible, infoPanelVisible, infoPanelCollapsed (folded to its one-line strip) and infoPanelTab (console, issues or preview, the Game Preview tab), toolbarVisible, the menu bar titles in order, menuBarInWindow (false once the menus moved into the native macOS menu bar), themeLook (classic or mac_glass), floatingWindows (${MCP_MAIN_WINDOW_FLOATING_WINDOW_LIST}: the Place, Textures and Levels tabs of the one Browser window, layout id browser) as true while the Browser is open on that tab, and toolWindows: every resizable, dockable tool window by layout id with its title, placement (left, right, bottom or floating), isOpen and rect ({left, top, width, height} in CSS pixels while open).`,
    emptySchema(),
  ),
  tool(
    'set_main_window',
    'Show or hide the inspector, info panel and toolbar, fold or unfold the info panel, switch the info panel tab, show or hide floating windows, dock or float tool windows, move and size floating tool windows, and tile the floating ones. Omitted fields stay as they are. Returns the new arrangement like get_main_window.',
    {
      type: 'object',
      properties: {
        inspectorVisible: { type: 'boolean', description: 'Show or hide the inspector on the right.' },
        infoPanelTab: {
          type: 'string',
          enum: ['console', 'issues', 'preview'],
          description: 'Info panel tab to show; preview is the Game Preview tab.',
        },
        infoPanelVisible: { type: 'boolean', description: 'Show or hide the info panel below the views.' },
        infoPanelCollapsed: {
          type: 'boolean',
          description:
            'Fold the info panel to its one-line strip (true) or unfold it to its remembered height (false).',
        },
        toolbarVisible: { type: 'boolean', description: 'Show or hide the icon toolbar.' },
        floatingWindows: {
          type: 'object',
          description: `Open or close the Browser window on a tab by id (${MCP_MAIN_WINDOW_FLOATING_WINDOW_LIST} for its Place, Textures and Levels tabs). True opens the Browser on that tab, false closes it while it shows that tab. Omitted ids stay as they are.`,
          properties: MCP_MAIN_WINDOW_FLOATING_WINDOW_PROPERTIES,
        },
        toolWindowPlacements: {
          type: 'object',
          description:
            'Dock tool windows by layout id (see get_main_window toolWindows) to left, right or bottom, where windows on the same edge become tabs, or float them with floating. Open windows move at once; closed ones open there next time.',
          additionalProperties: { type: 'string', enum: ['left', 'right', 'bottom', 'floating'] },
        },
        toolWindowRects: {
          type: 'object',
          description:
            'Floating position and size of tool windows by layout id: {left, top, width, height} in CSS pixels, at least 160 by 90.',
          additionalProperties: {
            type: 'object',
            properties: {
              left: { type: 'number' },
              top: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
            },
            required: ['left', 'top', 'width', 'height'],
          },
        },
        resetWindowLayout: {
          type: 'boolean',
          description:
            'True floats every tool window at its default place and size before the other tool window fields apply (Window > Reset Window Layout).',
        },
        tileFloatingWindows: {
          type: 'boolean',
          description:
            'True arranges the open floating tool windows side by side over the map area (Window > Tile Floating Windows).',
        },
      },
    },
  ),
  tool(
    'get_platform',
    'Read-only: what the editor adapted to its operating system. Returns platform (mac, windows, linux or other), themeLook (classic, mac_glass or mac_glass_dark) and deleteSelectionShortcuts (labels of every default key binding that deletes the selection, e.g. ["Del"] on Windows, ["⌦", "⌫", "⌘⌫"] on macOS).',
    emptySchema(),
  ),
  tool(
    'get_shell_layout',
    'Read-only screen rectangles ({x, y, width, height} in CSS pixels) of the main window areas: views (map views above the info panel), infoPanel (Console / Issues / Game Preview panel), inspector (right dock) and the tool window docks dockLeft, dockRight and dockBottom. Hidden areas are zero sized.',
    emptySchema(),
  ),
  tool(
    'get_properties_section',
    'The Properties section of the right dock, which always shows the selection: the visible tab, the ids of the tabs that apply to the selection in order (class_info, outputs, inputs, properties, visgroup, ...) and the ids of the objects it edits (empty with no selection).',
    emptySchema(),
  ),
  tool(
    'set_properties_section',
    'Show the Properties section of the right dock (like Alt+Enter), switch its tab, and optionally write designer comments onto every selected object as one undo step. Edits in the section apply at once. Returns the state like get_properties_section.',
    {
      type: 'object',
      properties: {
        tab: { type: 'string', description: 'Tab id to show, from get_properties_section.' },
        comments: {
          type: 'string',
          description: 'Designer comments written onto every selected object as one undo step. Needs a selection.',
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
