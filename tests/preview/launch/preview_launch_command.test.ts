import { describe, it, expect } from 'vitest';
import { previewLaunchCommandFromProject, PreviewLaunchCommandError } from '@/preview/launch/preview_launch_command.js';

/**
 * Serializes a project whose preview section is the given object.
 *
 * @param preview Preview section, or undefined to omit it.
 * @returns Project file text.
 */
function projectJsonCreate(preview: unknown): string {
  return JSON.stringify({ project_version: 1, project_id: 'launch-test', preview });
}

describe('previewLaunchCommandFromProject', () => {
  it('reads the program, arguments and endpoint and resolves the working directory against the project', () => {
    const preview = {
      program: 'cargo',
      arguments: ['run', '-p', 'game'],
      working_directory: 'game/../runtime',
      endpoint: 'http://127.0.0.1:15999',
    };
    const command = previewLaunchCommandFromProject(projectJsonCreate(preview), 'C:\\Games\\MyGame');
    expect(command.program).toBe(preview.program);
    expect(command.arguments).toEqual(preview.arguments);
    expect(command.endpoint).toBe(preview.endpoint);
    expect(command.workingDirectory).toBe('C:/Games/MyGame/runtime');
  });

  it('runs in the project directory when no working directory is given and keeps absolute ones', () => {
    const relative = previewLaunchCommandFromProject(projectJsonCreate({ program: 'game' }), '/home/dev/project/');
    expect(relative.workingDirectory).toBe('/home/dev/project');
    expect(relative.arguments).toEqual([]);
    const absolute = previewLaunchCommandFromProject(
      projectJsonCreate({ program: 'game', working_directory: 'D:/build' }),
      '/home/dev/project',
    );
    expect(absolute.workingDirectory).toBe('D:/build');
  });

  it('rejects projects that cannot start a preview', () => {
    expect(() => previewLaunchCommandFromProject('{ not json', '/project')).toThrow(PreviewLaunchCommandError);
    expect(() => previewLaunchCommandFromProject(projectJsonCreate(undefined), '/project')).toThrow(/preview/);
    expect(() => previewLaunchCommandFromProject(projectJsonCreate({ program: '  ' }), '/project')).toThrow(/program/);
    expect(() =>
      previewLaunchCommandFromProject(projectJsonCreate({ program: 'game', arguments: [1] }), '/project'),
    ).toThrow(/arguments/);
  });
});
