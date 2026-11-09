import { describe, expect, it } from 'vitest';
import { DesktopShellOpen } from '@/desktop/bun/shell/desktop_shell_open.js';

/**
 * Unit tests for building the command that opens a file with its default
 * application.
 */
describe('DesktopShellOpen', () => {
  it('uses start through cmd on Windows with the path quoted and in backslashes', () => {
    const forwardPath = 'C:/Games/My Game & Co/sprinkle/plants.txt';
    const command = DesktopShellOpen.commandBuild('win32', forwardPath);
    expect(command.program).toBe('cmd.exe');
    expect(command.isVerbatim).toBe(true);
    expect(command.arguments).toContain('start');
    expect(command.arguments[command.arguments.length - 1]).toBe(`"${forwardPath.replace(/\//g, '\\')}"`);
  });

  it('uses open on macOS and xdg-open elsewhere with the path as the only argument', () => {
    const path = '/home/someone/game/sprinkle/plants.txt';
    expect(DesktopShellOpen.commandBuild('darwin', path)).toEqual({
      program: 'open',
      arguments: [path],
      isVerbatim: false,
    });
    expect(DesktopShellOpen.commandBuild('linux', path)).toEqual({
      program: 'xdg-open',
      arguments: [path],
      isVerbatim: false,
    });
  });
});
