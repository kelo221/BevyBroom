import type { EditorApiHost } from './editor_api_host.js';
import { okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { ConsoleLog, CONSOLE_LOG_CAPACITY_DEFAULT } from '@/info_panel/console/console_log.js';
import type { ConsoleLogEntry } from '@/info_panel/console/console_log_entry.js';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProviderRegistry } from '@/info_panel/issues/issue_provider_registry.js';

/** Lines console_read returns when no limit is given. */
export const EDITOR_API_CONSOLE_READ_LIMIT_DEFAULT = 100;

/** Arguments of the console_read tool. */
export interface ConsoleReadArgs {
  /** Most lines returned, newest last. */
  limit?: number;
}

/** One console line as console_read returns it. */
interface EditorApiConsoleLine {
  level: string;
  time: string;
  text: string;
}

/** Reads the editor console and validates the map for the issues list. */
export class EditorApiInfoPanel {
  private readonly host: EditorApiHost;

  /**
   * Creates the info panel tools.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Returns the newest console lines with their level and time.
   *
   * @param args Optional line limit.
   * @returns Result with the lines, oldest first.
   */
  consoleRead(args: ConsoleReadArgs): McpToolResult {
    const limit = this.consoleLimitResolve(args.limit);
    const consoleLog = this.host.consoleLogRead?.() ?? ConsoleLog.shared();
    const lines = consoleLog.entriesRecentRead(limit).map((entry) => this.consoleLineConvert(entry));
    return okResult(`Read ${lines.length} console line(s)`, { lines });
  }

  /**
   * Validates the map now and returns every issue.
   *
   * @returns Result with the issues and their count.
   */
  issuesList(): McpToolResult {
    const issues = this.host.issuesValidateNow?.() ?? IssueProviderRegistry.issuesCollect(this.host.worldObject);
    const rows = issues.map((issue) => this.issueConvert(issue));
    return okResult(rows.length === 0 ? 'No issues' : `${rows.length} issue(s)`, { issues: rows, count: rows.length });
  }

  /**
   * Clamps a requested line limit to the console capacity.
   *
   * @param limit Requested limit, or undefined for the default.
   * @returns Whole number of lines to return.
   */
  private consoleLimitResolve(limit: number | undefined): number {
    if (typeof limit !== 'number' || !Number.isFinite(limit)) {
      return EDITOR_API_CONSOLE_READ_LIMIT_DEFAULT;
    }
    return Math.max(0, Math.min(CONSOLE_LOG_CAPACITY_DEFAULT, Math.floor(limit)));
  }

  /**
   * Converts a console line to its tool form.
   *
   * @param entry Console line.
   * @returns Level, ISO time and text.
   */
  private consoleLineConvert(entry: ConsoleLogEntry): EditorApiConsoleLine {
    return { level: entry.level, time: new Date(entry.timestampMilliseconds).toISOString(), text: entry.text };
  }

  /**
   * Converts an issue to its tool form.
   *
   * @param issue Issue.
   * @returns Plain issue row.
   */
  private issueConvert(issue: Issue): Record<string, unknown> {
    return {
      id: issue.id,
      severity: issue.severity,
      objectId: issue.objectUuid,
      objectName: issue.objectName,
      description: issue.description,
      provider: issue.providerId,
    };
  }
}
