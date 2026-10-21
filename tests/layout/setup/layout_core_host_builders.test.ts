import { describe, expect, it } from 'vitest';
import { buildWorkspaceAreaWiringHost } from '@/layout/setup/layout_core_host_builders.js';
import type { LayoutCoreHostSource } from '@/layout/setup/layout_core_host_builders.js';
import type { WorkspaceSwitcherBar } from '@/ui/workspace/workspace_switcher_bar.js';

/**
 * Builds a minimal host source with mutable bag fields for wiring tests.
 *
 * @returns Source and live field holders.
 */
function createMutableHostSource(): {
  source: LayoutCoreHostSource;
  liveSwitcher: { current: WorkspaceSwitcherBar | null };
} {
  const liveSwitcher = { current: null as WorkspaceSwitcherBar | null };
  const source = {
    workspaceSwitcherSlot: document.createElement('div'),
    viewportArea: document.createElement('div'),
    viewportPaneGrid: document.createElement('div'),
    workspaceStore: {} as LayoutCoreHostSource['workspaceStore'],
    workspaceController: null,
    workspaceSwitcherBar: null as WorkspaceSwitcherBar | null,
    areaLayoutInteraction: null,
    viewportRegistry: {} as LayoutCoreHostSource['viewportRegistry'],
    viewportPaneLayout: {
      getAreaLayoutController: () => ({}) as never,
    } as unknown as LayoutCoreHostSource['viewportPaneLayout'],
    detachedViewportWindow: { open: () => false } as LayoutCoreHostSource['detachedViewportWindow'],
    sharedWorldScene: {} as LayoutCoreHostSource['sharedWorldScene'],
    worldObject: {} as LayoutCoreHostSource['worldObject'],
    transformGizmo: {} as LayoutCoreHostSource['transformGizmo'],
    viewportSyncManager: {} as LayoutCoreHostSource['viewportSyncManager'],
    selectionVisualController: undefined,
    transformInteractionBridge: undefined,
    faceModeCoordinator: undefined,
    cameraFitCoordinator: undefined,
    shadingModeCoordinator: undefined,
    clipPlaneHandler: null,
    cadRulerSystem: {} as LayoutCoreHostSource['cadRulerSystem'],
    rulerBoundsBuilder: {} as LayoutCoreHostSource['rulerBoundsBuilder'],
    transformHandler: {} as LayoutCoreHostSource['transformHandler'],
    selectionManager: {} as LayoutCoreHostSource['selectionManager'],
    statusBar: null,
    editorOverlayPolicy: {} as LayoutCoreHostSource['editorOverlayPolicy'],
    setWorkspaceController: (controller: LayoutCoreHostSource['workspaceController']) => {
      source.workspaceController = controller;
    },
    setWorkspaceSwitcherBar: (bar: WorkspaceSwitcherBar | null) => {
      liveSwitcher.current = bar;
    },
    setAreaLayoutInteraction: (interaction: LayoutCoreHostSource['areaLayoutInteraction']) => {
      source.areaLayoutInteraction = interaction;
    },
    getViewportChromeHost: () => ({}) as ReturnType<LayoutCoreHostSource['getViewportChromeHost']>,
    resizeAll: () => undefined,
    refreshNamedViewportFields: () => undefined,
    rewireAfterAreaStructureChange: () => undefined,
    getPrimaryPerspectiveViewport: () => null,
    wireClipCallbackOnViewport: () => undefined,
    updateGizmoVisibility: () => undefined,
    attachCadRulers: () => undefined,
    showStatusMessage: () => undefined,
  } as LayoutCoreHostSource;
  return { source, liveSwitcher };
}

describe('buildWorkspaceAreaWiringHost', () => {
  it('should expose a workspace switcher bar after set for immediate insert placement', () => {
    const { source, liveSwitcher } = createMutableHostSource();
    const host = buildWorkspaceAreaWiringHost(source);
    const fakeBar = {
      getElement: () => document.createElement('div'),
    } as unknown as WorkspaceSwitcherBar;

    host.setWorkspaceSwitcherBar(fakeBar);

    expect(host.getWorkspaceSwitcherBar()).toBe(fakeBar);
    expect(liveSwitcher.current).toBe(fakeBar);
  });

  it('should hand out the view bar slot that receives the workspace switcher', () => {
    const { source } = createMutableHostSource();
    const host = buildWorkspaceAreaWiringHost(source);
    expect(host.getWorkspaceSwitcherSlot()).toBe(source.workspaceSwitcherSlot);
  });
});
