/** Visibility actions the set_selection_visibility tool accepts. */
export const MCP_SELECTION_VISIBILITY_ACTIONS = ['hide', 'isolate', 'show_all'] as const;

/** One visibility action of the set_selection_visibility tool. */
export type McpSelectionVisibilityAction = (typeof MCP_SELECTION_VISIBILITY_ACTIONS)[number];
