import { describe, expect, it } from 'vitest';
import type { GameProcessAction, GameProcessPhase } from '@/project/process/game_process_types.js';
import { projectWorkbenchActionIsAvailable } from '@/project/workbench/project_workbench_action_availability.js';
import { projectWorkbenchStatusLinesBuild } from '@/project/workbench/project_workbench_status_lines.js';
import { gameStatusCreate, projectSummaryCreate } from './project_workbench_rig.js';

/**
 * Returns the actions offered in a phase of an openable project.
 *
 * @param phase Game phase.
 * @returns Offered actions.
 */
function actionsOffered(phase: GameProcessPhase): GameProcessAction[] {
  const status = gameStatusCreate(projectSummaryCreate('/games/a/broom.project.json'), phase);
  const actions: GameProcessAction[] = ['launch', 'rebuild', 'restart', 'stop'];
  return actions.filter((action) => projectWorkbenchActionIsAvailable(status, action));
}

/**
 * Unit tests for which game actions are offered in each phase and for the
 * project status lines.
 */
describe('projectWorkbenchActionIsAvailable', () => {
  it('offers the recovery actions that fit each phase', () => {
    expect(actionsOffered('idle')).toEqual(['launch', 'rebuild']);
    expect(actionsOffered('build_failed')).toEqual(['launch', 'rebuild', 'restart']);
    expect(actionsOffered('running')).toEqual(['rebuild', 'restart', 'stop']);
    expect(actionsOffered('building')).toEqual(['stop']);
    expect(actionsOffered('stopping')).toEqual([]);
  });

  it('offers nothing without a project or with project errors', () => {
    expect(projectWorkbenchActionIsAvailable(null, 'launch')).toBe(false);
    const project = projectSummaryCreate('/games/b/broom.project.json');
    project.problems = [{ severity: 'error', message: 'launch program missing' }];
    expect(projectWorkbenchActionIsAvailable(gameStatusCreate(project, 'idle'), 'launch')).toBe(false);
  });

  it('does not offer rebuild when the project cannot be built', () => {
    const project = projectSummaryCreate('/games/c/broom.project.json');
    project.canBuild = false;
    expect(projectWorkbenchActionIsAvailable(gameStatusCreate(project, 'running'), 'rebuild')).toBe(false);
  });

  it('lists build errors and warns about a document of another project', () => {
    const status = gameStatusCreate(projectSummaryCreate('/games/d/broom.project.json'), 'build_failed');
    status.diagnostics = [{ severity: 'error', message: 'expected `;`', file: 'src/lib.rs', line: 2, column: 9 }];
    const lines = projectWorkbenchStatusLinesBuild(status, true);
    expect(lines.map((line) => line.text)).toContain('src/lib.rs:2:9: expected `;`');
    expect(lines.at(-1)?.isError).toBe(true);
    expect(projectWorkbenchStatusLinesBuild(null, false)[0]?.text).toContain('No project open');
  });
});
