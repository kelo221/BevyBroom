import { describe, expect, it, vi } from 'vitest';
import { ViewportPaneLayout } from '@/layout/viewport/viewport_pane_layout.js';
import { ViewportRegistry } from '@/layout/viewport/viewport_registry.js';
import { DEFAULT_AREA_IDS } from '@/layout/area/area_layout_presets.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import type { ViewportEditor } from '@/viewports/core/viewport_editor.js';
import type { LayoutViewportChromeHost } from '@/layout/setup/layout_viewport_chrome.js';
import {
  VIEW_CYCLE_KIND_ORDER,
  viewCycleHoveredPane,
  viewCycleHoveredPaneFind,
  viewCycleKindNext,
  viewMaximizeHoveredPane,
} from '@/layout/view_cycle/layout_view_cycle.js';

/**
 * Creates an object whose every property is a function returning the same
 * object, standing in for editor parts the view cycle only calls through.
 *
 * @returns Call-through stub.
 */
function callThroughStubCreate(): Record<string, unknown> {
  const stub: Record<string, unknown> = new Proxy(
    {},
    {
      get: () => () => stub,
    },
  );
  return stub;
}

/**
 * Creates a viewport stub of one kind that answers every other call.
 *
 * @param kind Viewport kind the stub reports.
 * @returns Viewport stub.
 */
function viewportStubCreate(kind: ViewportKind): ViewportEditor {
  const callThrough = callThroughStubCreate();
  return new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === 'getViewportKind') return () => kind;
        if (property === 'getIsDisposed') return () => false;
        if (property === 'then') return undefined;
        return () => callThrough;
      },
    },
  ) as ViewportEditor;
}

/**
 * Test rig with a quad layout, its registry, and a movable hovered viewport
 * index.
 */
interface ViewCycleRig {
  layer: HTMLElement;
  registry: ViewportRegistry;
  host: LayoutViewportChromeHost;
  hoveredIndexSet(index: number): void;
}

/**
 * Builds a quad layout of real panes with stub viewports and a chrome host
 * whose hovered viewport the test chooses.
 *
 * @returns View cycle rig.
 */
function viewCycleRigCreate(): ViewCycleRig {
  const layer = document.createElement('div');
  Object.defineProperty(layer, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(layer, 'clientHeight', { value: 600, configurable: true });
  document.body.appendChild(layer);
  const areaKinds: ReadonlyArray<readonly [string, ViewportKind]> = [
    [DEFAULT_AREA_IDS.top, ViewportKind.TOP],
    [DEFAULT_AREA_IDS.front, ViewportKind.FRONT],
    [DEFAULT_AREA_IDS.side, ViewportKind.SIDE],
    [DEFAULT_AREA_IDS.perspective, ViewportKind.PERSPECTIVE],
  ];
  const containers = areaKinds.map(([areaId]) => {
    const element = document.createElement('div');
    element.dataset['areaId'] = areaId;
    layer.appendChild(element);
    return element;
  });
  const layout = new ViewportPaneLayout(layer, containers);
  layout.apply(4);
  const registry = new ViewportRegistry((kind) => viewportStubCreate(kind));
  registry.setFactoryDependencies({ inputManager: {} as never, sharedScene: {} as never, surface: {} as never });
  areaKinds.forEach(([areaId, kind], index) => {
    const container = containers[index];
    if (container) registry.addPaneWithKind(areaId, container, kind);
  });
  let hoveredIndex = 0;
  const host = {
    viewportRegistry: registry,
    viewportPaneLayout: layout,
    viewportSyncManager: callThroughStubCreate(),
    worldObject: callThroughStubCreate(),
    transformGizmo: callThroughStubCreate(),
    selectionVisualController: undefined,
    transformInteractionBridge: undefined,
    faceModeCoordinator: undefined,
    clipPlaneHandler: null,
    shadingModeCoordinator: {
      getOrderedViewports: () => registry.getActiveViewports(),
      getActiveViewportIndex: () => hoveredIndex,
      rebindViewportUi: () => undefined,
      updateShadingMeshes: () => undefined,
    },
    resizeAll: vi.fn(),
    attachCadRulers: vi.fn(),
    refreshNamedViewportFields: vi.fn(),
    showStatusMessage: vi.fn(),
    persistActiveWorkspaceLayout: vi.fn(),
  } as unknown as LayoutViewportChromeHost;
  return { layer, registry, host, hoveredIndexSet: (index) => (hoveredIndex = index) };
}

describe('view cycle kind order', () => {
  it('visits every view kind once before wrapping back to the first', () => {
    const visited: ViewportKind[] = [];
    let kind = VIEW_CYCLE_KIND_ORDER[0] ?? ViewportKind.PERSPECTIVE;
    for (let step = 0; step < VIEW_CYCLE_KIND_ORDER.length; step++) {
      visited.push(kind);
      kind = viewCycleKindNext(kind);
    }
    expect(new Set(visited).size).toBe(Object.values(ViewportKind).length);
    expect(kind).toBe(VIEW_CYCLE_KIND_ORDER[0]);
  });
});

describe('view cycle on the hovered pane', () => {
  it('finds the pane that owns the hovered viewport', () => {
    const rig = viewCycleRigCreate();
    const viewports = rig.registry.getActiveViewports();
    viewports.forEach((viewport, index) => {
      rig.hoveredIndexSet(index);
      expect(viewCycleHoveredPaneFind(rig.host)?.getViewport()).toBe(viewport);
    });
    rig.layer.remove();
  });

  it('switches only the hovered pane to the next kind and fits its new viewport', () => {
    const rig = viewCycleRigCreate();
    const targetIndex = rig.registry.getActiveViewports().length - 1;
    rig.hoveredIndexSet(targetIndex);
    const pane = viewCycleHoveredPaneFind(rig.host);
    const otherKindsBefore = rig.registry
      .getPanes()
      .filter((other) => other !== pane)
      .map((other) => other.getKind());
    const kindBefore = pane?.getKind() ?? ViewportKind.PERSPECTIVE;
    const fit = vi.fn();
    expect(viewCycleHoveredPane(rig.host, fit)).toBe(true);
    expect(pane?.getKind()).toBe(viewCycleKindNext(kindBefore));
    expect(pane?.getViewport()?.getViewportKind()).toBe(viewCycleKindNext(kindBefore));
    expect(fit).toHaveBeenCalledOnce();
    expect(fit.mock.calls[0]?.[0]).toBe(pane?.getViewport());
    const otherKindsAfter = rig.registry
      .getPanes()
      .filter((other) => other !== pane)
      .map((other) => other.getKind());
    expect(otherKindsAfter).toEqual(otherKindsBefore);
    expect(rig.host.persistActiveWorkspaceLayout).toHaveBeenCalled();
    rig.layer.remove();
  });

  it('does nothing when no viewport is hovered', () => {
    const rig = viewCycleRigCreate();
    rig.hoveredIndexSet(rig.registry.getActiveViewports().length + 5);
    const fit = vi.fn();
    expect(viewCycleHoveredPane(rig.host, fit)).toBe(false);
    expect(viewMaximizeHoveredPane(rig.host)).toBe(false);
    expect(fit).not.toHaveBeenCalled();
    rig.layer.remove();
  });

  it('maximizes the hovered pane and restores the layout on the second press', () => {
    const rig = viewCycleRigCreate();
    const paneCount = rig.registry.getActiveViewports().length;
    rig.hoveredIndexSet(1);
    const hoveredViewport = rig.registry.getActiveViewports()[1];
    expect(viewMaximizeHoveredPane(rig.host)).toBe(true);
    expect(rig.registry.getActiveViewports()).toHaveLength(1);
    expect(rig.registry.getActiveViewports()[0]).toBe(hoveredViewport);
    rig.hoveredIndexSet(0);
    expect(viewMaximizeHoveredPane(rig.host)).toBe(true);
    expect(rig.registry.getActiveViewports()).toHaveLength(paneCount);
    rig.layer.remove();
  });
});
