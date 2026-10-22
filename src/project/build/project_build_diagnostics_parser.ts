/** One compiler message with its source location. */
export interface ProjectBuildDiagnostic {
  severity: 'error' | 'warning';
  message: string;
  /**
   * Source file as the compiler printed it; empty when the message has no
   * location.
   */
  file: string;
  /** One-based line; 0 when unknown. */
  line: number;
  /** One-based column; 0 when unknown. */
  column: number;
}

/** Short cargo format: `path:line:col: error[E0425]: message`. */
const SHORT_FORMAT_PATTERN = /^(.+?):(\d+):(\d+): (error|warning)(\[[A-Za-z0-9]+\])?: (.+)$/;

/** Human cargo header: `error[E0425]: message`. */
const HUMAN_HEADER_PATTERN = /^(error|warning)(\[[A-Za-z0-9]+\])?: (.+)$/;

/** Human cargo location line: ` --> path:line:col`. */
const HUMAN_LOCATION_PATTERN = /^\s*--> (.+?):(\d+):(\d+)\s*$/;

/** Summary lines cargo prints that are not compiler messages. */
const SUMMARY_PATTERN = /^(error|warning): (could not compile|build failed|aborting due|`.+` \(.+\) generated)/;

/**
 * Turns compiler output into messages with source locations. It reads cargo's
 * short format and its human format.
 */
export class ProjectBuildDiagnosticsParser {
  /**
   * Parses compiler output.
   *
   * @param output Text the build printed, stdout and stderr together.
   * @returns Messages in output order.
   */
  static parse(output: string): ProjectBuildDiagnostic[] {
    const diagnostics: ProjectBuildDiagnostic[] = [];
    let pendingHuman: ProjectBuildDiagnostic | null = null;
    for (const rawLine of output.split(/\r?\n/)) {
      const line = rawLine.replace(/\u001b\[[0-9;]*m/g, '');
      const location = pendingHuman ? HUMAN_LOCATION_PATTERN.exec(line) : null;
      if (pendingHuman && location) {
        ProjectBuildDiagnosticsParser.locationApply(pendingHuman, location);
        pendingHuman = null;
        continue;
      }
      const parsed = ProjectBuildDiagnosticsParser.lineParse(line);
      if (parsed) {
        diagnostics.push(parsed);
        pendingHuman = parsed.file === '' ? parsed : null;
      }
    }
    return diagnostics;
  }

  /**
   * Parses one line that starts a message.
   *
   * @param line Output line without color codes.
   * @returns Message, or null for other lines and cargo summaries.
   */
  private static lineParse(line: string): ProjectBuildDiagnostic | null {
    if (SUMMARY_PATTERN.test(line)) {
      return null;
    }
    const short = SHORT_FORMAT_PATTERN.exec(line);
    if (short) {
      return ProjectBuildDiagnosticsParser.shortMatchRead(short);
    }
    const header = HUMAN_HEADER_PATTERN.exec(line);
    return header ? ProjectBuildDiagnosticsParser.headerMatchRead(header) : null;
  }

  /**
   * Builds a message from a short-format line.
   *
   * @param short Match of the short format.
   * @returns Message with its location.
   */
  private static shortMatchRead(short: RegExpExecArray): ProjectBuildDiagnostic {
    return {
      severity: short[4] === 'warning' ? 'warning' : 'error',
      message: `${short[5] ?? ''}${short[5] ? ' ' : ''}${short[6] ?? ''}`.trim(),
      file: short[1] ?? '',
      line: Number(short[2]),
      column: Number(short[3]),
    };
  }

  /**
   * Builds a message from a human-format header line; its location follows
   * later.
   *
   * @param header Match of the header.
   * @returns Message without a location.
   */
  private static headerMatchRead(header: RegExpExecArray): ProjectBuildDiagnostic {
    const code = header[2] ? `${header[2]} ` : '';
    return {
      severity: header[1] === 'warning' ? 'warning' : 'error',
      message: `${code}${header[3] ?? ''}`,
      file: '',
      line: 0,
      column: 0,
    };
  }

  /**
   * Copies a human-format location onto its message.
   *
   * @param diagnostic Message waiting for its location.
   * @param location Match of the location line.
   */
  private static locationApply(diagnostic: ProjectBuildDiagnostic, location: RegExpExecArray): void {
    diagnostic.file = location[1] ?? '';
    diagnostic.line = Number(location[2]);
    diagnostic.column = Number(location[3]);
  }

  /**
   * Formats a message as `file:line:column: message`.
   *
   * @param diagnostic Message.
   * @returns One display line.
   */
  static describe(diagnostic: ProjectBuildDiagnostic): string {
    const location = diagnostic.file === '' ? '' : `${diagnostic.file}:${diagnostic.line}:${diagnostic.column}: `;
    return `${location}${diagnostic.message}`;
  }
}
