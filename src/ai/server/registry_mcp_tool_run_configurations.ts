import { emptySchema, tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** Schema of one run configuration as the project file stores it. */
const MCP_RUN_CONFIGURATION_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Stable id, unique in the project.' },
    name: { type: 'string', description: 'Name in the Run menu.' },
    steps: {
      type: 'array',
      description:
        'Steps run from first to last. Each holds kind (level_save, level_package_build, command, game_play, game_stop), optional enabled:false to skip it, and the fields of its kind: command takes program, arguments (list of texts; {level_id}, {level_document}, {level_export_directory} and {project_directory} are replaced) and working_directory (relative to the project).',
      items: { type: 'object' },
    },
  },
  required: ['id', 'name', 'steps'],
};

/**
 * Tools that list, store and run the run configurations of the open project,
 * the step lists F9 and the Run menu run, such as Play or Bake Lighting.
 */
export const MCP_RUN_CONFIGURATION_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'list_run_configurations',
    'The run configurations of the open project (its stored ones, or the default Play when it stores none), whether they are stored in the project file, the active one F9 runs, the step kinds with their fields, and the state of the last run (configurationId, phase running/succeeded/failed, stepIndex, message). Desktop app only.',
    emptySchema(),
  ),
  tool(
    'set_run_configurations',
    'Store run configurations in the open project file (an empty list removes them) and optionally pick the active one F9 runs on this computer. Returns them as stored. Desktop app only.',
    {
      type: 'object',
      properties: {
        configurations: { type: 'array', items: MCP_RUN_CONFIGURATION_SCHEMA },
        activeId: { type: 'string', description: 'Id of the configuration F9 runs.' },
      },
      required: ['configurations'],
    },
  ),
  tool(
    'run_configuration',
    'Run a run configuration of the open project, as the Run menu does; without configurationId the active one runs, as F9 does. Returns at once with the run state; poll list_run_configurations until its run phase is succeeded or failed. Desktop app only.',
    {
      type: 'object',
      properties: {
        configurationId: { type: 'string', description: 'Id of the configuration; the active one when left out.' },
      },
    },
  ),
];
