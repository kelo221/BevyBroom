import { afterEach, describe, expect, it } from 'vitest';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { issueCreate } from '@/info_panel/issues/issue.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';

/** One console line as console_read returns it. */
interface ConsoleLine {
  level: string;
  time: string;
  text: string;
}

/** One issue as issues_list returns it. */
interface IssueRow {
  severity: string;
  objectId: string | null;
  description: string;
  provider: string;
}

/** Unit tests for the console_read and issues_list MCP tools. */
describe('EditorApi info panel tools', () => {
  afterEach(() => {
    ConsoleLog.resetForTests();
  });

  it('lists both tools in the MCP catalog', () => {
    expect(findMcpTool('console_read')).toBeDefined();
    expect(findMcpTool('issues_list')).toBeDefined();
  });

  it('reads the newest console lines with level and time, honoring the limit', () => {
    const log = ConsoleLog.shared();
    log.entryAppendInfo('first');
    log.entryAppendWarning('second');
    log.entryAppendError('third');
    const api = new EditorApi(editorApiTestHostCreate().host);
    const result = api.invokeTool('console_read', { limit: 2 });
    expect(result.ok).toBe(true);
    const lines = (result.data as { lines: ConsoleLine[] }).lines;
    expect(lines.map((line) => [line.level, line.text])).toEqual([
      ['warning', 'second'],
      ['error', 'third'],
    ]);
    expect(Number.isNaN(Date.parse(lines[0]?.time ?? ''))).toBe(false);
  });

  it('reads a status message an editing tool published', () => {
    const { host } = editorApiTestHostCreate({ showStatus: (message) => ConsoleLog.shared().entryAppendInfo(message) });
    const api = new EditorApi(host);
    const created = api.invokeTool('create_solid_model', { name: 'Logged' });
    expect(created.ok).toBe(true);
    const lines = (api.invokeTool('console_read', {}).data as { lines: ConsoleLine[] }).lines;
    expect(lines.some((line) => line.text.includes('Logged'))).toBe(true);
  });

  it('validates the map now and lists the issue of a model whose only brush was deleted', () => {
    const parts = editorApiTestHostCreate();
    const api = new EditorApi(parts.host);
    const created = api.invokeTool('create_solid_model', { name: 'Emptied' });
    const { modelId, brushId } = created.data as { modelId: string; brushId: string };
    expect((api.invokeTool('issues_list').data as { count: number }).count).toBe(0);
    expect(api.invokeTool('delete_brushes', { brushIds: [brushId] }).ok).toBe(true);
    const listed = api.invokeTool('issues_list');
    const issues = (listed.data as { issues: IssueRow[] }).issues;
    expect(issues.map((issue) => [issue.objectId, issue.provider])).toEqual([[modelId, 'solid_model_warnings']]);
    expect(issues[0]?.description).toBe('Solid model has no brushes');
  });

  it('uses the host validation hook when the layout provides one', () => {
    const hooked = issueCreate('hooked', { severity: 'error', objectUuid: null, objectName: 'x', description: 'Hook' });
    const { host } = editorApiTestHostCreate({ issuesValidateNow: () => [hooked] });
    const issues = (new EditorApi(host).invokeTool('issues_list').data as { issues: IssueRow[] }).issues;
    expect(issues.map((issue) => issue.provider)).toEqual(['hooked']);
  });
});
