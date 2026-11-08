import { describe, expect, it } from 'vitest';
import { projectWorkbenchOpenKeyRead } from '@/project/workbench/project_workbench_open_key.js';
import { workbenchRigCreate } from './project_workbench_rig.js';

/** Unit tests for the key that changes whenever a project is opened. */
describe('projectWorkbenchOpenKeyRead', () => {
  it('is null without a project and changes on every open, even of the same project', async () => {
    const rig = workbenchRigCreate();
    expect(projectWorkbenchOpenKeyRead(rig.workbench)).toBeNull();
    const projectFile = '/games/keyed/broom.project.json';
    await rig.workbench.projectOpen(projectFile);
    const firstKey = projectWorkbenchOpenKeyRead(rig.workbench);
    expect(firstKey).toContain(projectFile);
    await rig.workbench.projectOpen(projectFile);
    const secondKey = projectWorkbenchOpenKeyRead(rig.workbench);
    expect(secondKey).toContain(projectFile);
    expect(secondKey).not.toBe(firstKey);
  });
});
