import * as THREE from 'three';
import { vi } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { HandlerSceneIo } from '@/tools/io/handler_scene_io.js';
import { ProjectLevelService } from '@/project/level/project_level_service.js';
import {
  LayoutViewportProjectLevelActions,
  type LayoutViewportProjectLevelActionsContext,
} from '@/layout/viewport/layout_viewport_project_level_actions.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { workbenchRigCreate } from '../workbench/project_workbench_rig.js';

/** Project file of the fake project the level rig opens. */
export const PROJECT_LEVEL_TEST_PROJECT_FILE = '/games/level rig/broom.project.json';

/**
 * Builds a level service over a workbench rig and the layout's project level
 * actions over a real scene IO handler and world.
 *
 * @param worldObject World root the actions act on; a fresh group when omitted.
 * @returns Rig parts, the service, the actions and the context spies.
 */
export function projectLevelActionsRigCreate(worldObject: THREE.Group = new THREE.Group()) {
  const rig = workbenchRigCreate(worldObject);
  const service = new ProjectLevelService({ workbench: rig.workbench, control: rig.control });
  const levelBrowserReveal = vi.fn<(isNameFieldFocused: boolean) => void>();
  const onSceneLoaded = vi.fn();
  const context: LayoutViewportProjectLevelActionsContext = {
    toolbarContainer: document.createElement('div'),
    sceneIOHandler: new HandlerSceneIo(),
    worldObject,
    commandStack: new CommandStack(16),
    statusBar: null,
    solidModelController: null,
    serviceRead: () => service,
    onSceneLoaded,
    sceneRecoveryRead: () => null,
    levelBrowserReveal,
  };
  const actions = new LayoutViewportProjectLevelActions(() => context);
  return { ...rig, service, actions, context, levelBrowserReveal, onSceneLoaded };
}

/**
 * Opens the fake project in a level rig and waits for its levels to be listed.
 *
 * @param rig Level rig.
 */
export async function projectLevelRigProjectOpen(rig: ReturnType<typeof projectLevelActionsRigCreate>): Promise<void> {
  await rig.workbench.projectOpen(PROJECT_LEVEL_TEST_PROJECT_FILE);
  await rig.service.idle();
}

/**
 * Adds a named portal to a world and returns the scene text as Save writes it.
 *
 * @param sceneIOHandler Scene IO handler that serializes.
 * @param worldObject World root to fill.
 * @param portalName Name of the portal.
 * @returns Scene document text.
 */
export function projectLevelTestSceneTextBuild(
  sceneIOHandler: HandlerSceneIo,
  worldObject: THREE.Group,
  portalName: string,
): string {
  worldObject.add(PortalOwner.createDefault(portalName));
  return sceneIOHandler.sceneJsonBuild(worldObject);
}

/**
 * Returns the names of the portals in a world.
 *
 * @param worldObject World root.
 * @returns Portal names in tree order.
 */
export function projectLevelTestPortalNamesRead(worldObject: THREE.Object3D): string[] {
  return PortalOwner.collectUnder(worldObject).map((portal) => portal.name);
}
