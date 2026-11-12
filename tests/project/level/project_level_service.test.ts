import { describe, expect, it } from 'vitest';
import {
  PROJECT_LEVEL_NO_PROJECT_MESSAGE,
  PROJECT_LEVEL_NONE_OPEN_MESSAGE,
  ProjectLevelService,
} from '@/project/level/project_level_service.js';
import { GameProcessControlUnavailable } from '@/project/control/game_process_control.js';
import { workbenchRigCreate } from '../workbench/project_workbench_rig.js';

/** Project file of the first fake project. */
const FIRST_PROJECT_FILE = '/games/first/broom.project.json';

/** Project file of the second fake project. */
const SECOND_PROJECT_FILE = '/games/second/broom.project.json';

/**
 * Creates a workbench rig with a level service following it.
 *
 * @returns Rig parts and the service.
 */
function serviceRigCreate() {
  const rig = workbenchRigCreate();
  const changes: number[] = [];
  const service = new ProjectLevelService({ workbench: rig.workbench, control: rig.control });
  service.changeListenerAdd(() => changes.push(service.listStateRead().levels.length));
  return { ...rig, service, changes };
}

/** The service lists project levels and tracks the one the scene belongs to. */
describe('ProjectLevelService', () => {
  it('explains that no project is open and lists the documents once one opens', async () => {
    const { workbench, control, service } = serviceRigCreate();
    expect(service.listStateRead()).toMatchObject({ levels: [], message: PROJECT_LEVEL_NO_PROJECT_MESSAGE });
    control.projectLevelDocumentsRead(FIRST_PROJECT_FILE).set('hall.json', '{"hall":1}');
    await workbench.projectOpen(FIRST_PROJECT_FILE);
    await service.idle();
    const state = service.listStateRead();
    expect(state.message).toBeNull();
    expect(state.levels.map((level) => level.document)).toEqual(['hall.json']);
    expect(service.levelFind('hall')?.document).toBe('hall.json');
    expect(service.levelFind('hall.json')?.id).toBe('hall');
    expect(service.levelFind('missing')).toBeNull();
    service.dispose();
  });

  it('reads a document, adopts it as the open level and writes back to it', async () => {
    const { workbench, control, service } = serviceRigCreate();
    control.projectLevelDocumentsRead(FIRST_PROJECT_FILE).set('hall.json', '{"hall":1}');
    await workbench.projectOpen(FIRST_PROJECT_FILE);
    await service.idle();
    expect(await service.openLevelWrite('{}', false)).toEqual({ ok: false, message: PROJECT_LEVEL_NONE_OPEN_MESSAGE });
    const read = await service.documentRead('hall.json');
    expect(read.ok ? read.text : read).toBe('{"hall":1}');
    if (read.ok) {
      service.openLevelAdopt(read.level);
    }
    expect(service.openLevelRead()).toMatchObject({ projectFile: FIRST_PROJECT_FILE, document: 'hall.json' });
    const written = await service.openLevelWrite('{"hall":2}', false);
    expect(written.ok).toBe(true);
    expect(control.projectLevelDocumentsRead(FIRST_PROJECT_FILE).get('hall.json')).toBe('{"hall":2}');
    expect(service.openLevelRead()?.knownModifiedMilliseconds).toBe(control.nextLevelModifiedMilliseconds);
    service.dispose();
  });

  it('creates a level as the open level, renames it and forgets it on request', async () => {
    const { workbench, control, service } = serviceRigCreate();
    await workbench.projectOpen(FIRST_PROJECT_FILE);
    await service.idle();
    const created = await service.levelCreate('Castle Hall', '{"c":1}');
    expect(created.ok).toBe(true);
    expect(service.openLevelRead()?.document).toBe('castle_hall.json');
    expect(service.listStateRead().levels.map((level) => level.document)).toEqual(['castle_hall.json']);
    const renamed = await service.levelRename('castle_hall.json', 'Keep');
    expect(renamed.ok).toBe(true);
    expect(service.openLevelRead()?.document).toBe('keep.json');
    expect(control.projectLevelDocumentsRead(FIRST_PROJECT_FILE).get('keep.json')).toBe('{"c":1}');
    service.openLevelForget();
    expect(service.openLevelRead()).toBeNull();
    service.dispose();
  });

  it('keeps the open level when the same project opens again and drops it for another project', async () => {
    const { workbench, service } = serviceRigCreate();
    await workbench.projectOpen(FIRST_PROJECT_FILE);
    await service.idle();
    await service.levelCreate('hall', '{}');
    await workbench.projectOpen(FIRST_PROJECT_FILE);
    await service.idle();
    expect(service.openLevelRead()?.document).toBe('hall.json');
    await workbench.projectOpen(SECOND_PROJECT_FILE);
    await service.idle();
    expect(service.openLevelRead()).toBeNull();
    expect(service.listStateRead().levels).toEqual([]);
    service.dispose();
  });

  it('explains that project levels need the desktop app when the control is unavailable', () => {
    const rig = workbenchRigCreate();
    const service = new ProjectLevelService({ workbench: rig.workbench, control: new GameProcessControlUnavailable() });
    const state = service.listStateRead();
    expect(state.isAvailable).toBe(false);
    expect(state.message).toContain('desktop app');
    service.dispose();
  });
});
