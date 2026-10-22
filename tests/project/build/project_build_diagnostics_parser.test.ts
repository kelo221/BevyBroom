import { describe, expect, it } from 'vitest';
import { ProjectBuildDiagnosticsParser } from '@/project/build/project_build_diagnostics_parser.js';

/** Compiler output becomes messages with source locations. */
describe('ProjectBuildDiagnosticsParser', () => {
  it('reads the short cargo format including Windows paths and ignores summaries', () => {
    const output = [
      '   Compiling game v0.1.0 (C:\\Games\\game)',
      'src\\main.rs:7:13: error[E0425]: cannot find value `missing` in this scope',
      'C:\\Games\\game\\src\\lib.rs:2:5: warning: unused variable: `x`',
      'error: could not compile `game` (bin "game") due to 1 previous error',
    ].join('\r\n');
    const diagnostics = ProjectBuildDiagnosticsParser.parse(output);
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0]).toMatchObject({ severity: 'error', file: 'src\\main.rs', line: 7, column: 13 });
    expect(diagnostics[0]?.message).toContain('E0425');
    expect(diagnostics[1]).toMatchObject({
      severity: 'warning',
      file: 'C:\\Games\\game\\src\\lib.rs',
      line: 2,
      column: 5,
    });
  });

  it('reads the human cargo format with its location line and color codes', () => {
    const output = [
      '\u001b[1m\u001b[31merror[E0308]\u001b[0m: mismatched types',
      '  --> src/main.rs:4:18',
      '   |',
      'error: aborting due to 1 previous error',
    ].join('\n');
    const diagnostics = ProjectBuildDiagnosticsParser.parse(output);
    expect(diagnostics).toEqual([
      { severity: 'error', message: '[E0308] mismatched types', file: 'src/main.rs', line: 4, column: 18 },
    ]);
    const first = diagnostics[0];
    if (!first) throw new Error('no diagnostic parsed');
    expect(ProjectBuildDiagnosticsParser.describe(first)).toBe('src/main.rs:4:18: [E0308] mismatched types');
  });

  it('returns nothing for a clean build', () => {
    expect(ProjectBuildDiagnosticsParser.parse('   Compiling game\n    Finished `release` profile')).toEqual([]);
  });
});
