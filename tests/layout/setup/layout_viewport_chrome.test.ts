import { describe, expect, it, vi } from 'vitest';
import { ViewportRegistry } from '@/layout/viewport/viewport_registry.js';
import type { ViewportPane } from '@/layout/viewport/viewport_pane.js';
import {
  onViewportKindChange,
  wireToolbarForPane,
  type LayoutViewportChromeHost,
} from '@/layout/setup/layout_viewport_chrome.js';
import { ShadingMode } from '@/types/shading_mode.js';
import { ViewportToolbar } from '@/ui/viewport_chrome/viewport_toolbar.js';
import { VIEWPORT_VIEW_CHOICES_3D } from '@/ui/viewport_chrome/viewport_view_choices.js';
import { ViewportKind, getViewportKindDisplayLabel } from '@/viewports/core/viewport_kind.js';
import type { ViewportEditor } from '@/viewports/core/viewport_editor.js';

/** Shading mode every stub viewport starts with. */
const LAYOUT_CHROME_TEST_DEFAULT_SHADING = ShadingMode.SOLID;

/**
 * Creates an object whose every property is a function returning the same
 * object, standing in for editor parts the chrome wiring only calls through.
 *
 * @returns Call-through stub.
 */
function layoutChromeTestCallThroughCreate(): Record<string, unknown> {
  const stub: Record<string, unknown> = new Proxy(
    {},
    {
      get: () => () => stub,
    },
  );
  return stub;
}

/**
 * Returns the calls a viewport stub answers itself: its kind, a real toolbar,
 * and a remembered shading mode.
 *
 * @param kind Viewport kind the stub reports.
 * @returns Method implementations keyed by method name.
 */
function layoutChromeTestViewportOverridesCreate(kind: ViewportKind): Record<string, unknown> {
  const toolbar = new ViewportToolbar(
    document.createElement('div'),
    getViewportKindDisplayLabel(kind),
    LAYOUT_CHROME_TEST_DEFAULT_SHADING,
  );
  let shadingMode = LAYOUT_CHROME_TEST_DEFAULT_SHADING;
  return {
    getViewportKind: () => kind,
    getIsDisposed: () => false,
    getViewportToolbar: () => toolbar,
    getShadingMode: () => shadingMode,
    setShadingMode: (mode: ShadingMode) => (shadingMode = mode),
    areContentWireframesVisible: () => true,
    isProjectedGridVisible: () => true,
  };
}

/**
 * Creates a viewport stub of one kind with a real toolbar and a remembered
 * shading mode; every other call goes through a call-through stub.
 *
 * @param kind Viewport kind the stub reports.
 * @returns Viewport stub.
 */
function layoutChromeTestViewportCreate(kind: ViewportKind): ViewportEditor {
  const callThrough = layoutChromeTestCallThroughCreate();
  const overrides = layoutChromeTestViewportOverridesCreate(kind);
  return new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === 'then') return undefined;
        if (typeof property === 'string' && property in overrides) return overrides[property];
        return () => callThrough;
      },
    },
  ) as ViewportEditor;
}

/** Chrome host with one orthographic pane. */
interface LayoutChromeTestRig {
  host: LayoutViewportChromeHost;
  pane: ViewportPane;
}

/**
 * Builds a chrome host over a registry with stub layout parts and spy actions.
 *
 * @param registry Registry holding the panes.
 * @returns Chrome host.
 */
function layoutChromeTestHostCreate(registry: ViewportRegistry): LayoutViewportChromeHost {
  return {
    viewportRegistry: registry,
    viewportPaneLayout: layoutChromeTestCallThroughCreate(),
    viewportSyncManager: layoutChromeTestCallThroughCreate(),
    worldObject: layoutChromeTestCallThroughCreate(),
    transformGizmo: layoutChromeTestCallThroughCreate(),
    selectionVisualController: undefined,
    transformInteractionBridge: undefined,
    shadingModeCoordinator: undefined,
    faceModeCoordinator: undefined,
    clipPlaneHandler: null,
    resizeAll: vi.fn(),
    attachCadRulers: vi.fn(),
    refreshNamedViewportFields: vi.fn(),
    showStatusMessage: vi.fn(),
    persistActiveWorkspaceLayout: vi.fn(),
  } as unknown as LayoutViewportChromeHost;
}

/**
 * Builds a chrome host whose registry holds one Top pane of stub viewports.
 *
 * @returns Host and its pane.
 */
function layoutChromeTestRigCreate(): LayoutChromeTestRig {
  const registry = new ViewportRegistry((kind) => layoutChromeTestViewportCreate(kind));
  registry.setFactoryDependencies({ inputManager: {} as never, sharedScene: {} as never, surface: {} as never });
  const pane = registry.addPaneWithKind('layout-chrome-test-pane', document.createElement('div'), ViewportKind.TOP);
  return { host: layoutChromeTestHostCreate(registry), pane };
}

/**
 * Returns the live viewport of a pane that must exist.
 *
 * @param pane Pane to read.
 * @returns Live viewport.
 */
function layoutChromeTestViewportRead(pane: ViewportPane): ViewportEditor {
  const viewport = pane.getViewport();
  if (!viewport) {
    throw new Error('Pane has no viewport');
  }
  return viewport;
}

describe('onViewportKindChange', () => {
  it('replaces the pane viewport and applies the shading chosen with the kind', () => {
    const { host, pane } = layoutChromeTestRigCreate();
    const previousViewport = layoutChromeTestViewportRead(pane);
    onViewportKindChange(host, pane.getId(), ViewportKind.PERSPECTIVE, ShadingMode.FLAT);
    const viewport = layoutChromeTestViewportRead(pane);
    expect(viewport).not.toBe(previousViewport);
    expect(pane.getKind()).toBe(ViewportKind.PERSPECTIVE);
    expect(viewport.getShadingMode()).toBe(ShadingMode.FLAT);
    expect(viewport.getViewportToolbar().getActiveShadingMode()).toBe(ShadingMode.FLAT);
  });

  it('keeps the default shading of the new viewport when no shading was chosen', () => {
    const { host, pane } = layoutChromeTestRigCreate();
    onViewportKindChange(host, pane.getId(), ViewportKind.FRONT, null);
    const viewport = layoutChromeTestViewportRead(pane);
    expect(pane.getKind()).toBe(ViewportKind.FRONT);
    expect(viewport.getShadingMode()).toBe(LAYOUT_CHROME_TEST_DEFAULT_SHADING);
  });
});

describe('wireToolbarForPane', () => {
  it('turns a 2D pane into a perspective pane with the shading of the chosen 3D menu row', () => {
    const { host, pane } = layoutChromeTestRigCreate();
    const toolbar = layoutChromeTestViewportRead(pane).getViewportToolbar();
    wireToolbarForPane(host, pane, layoutChromeTestViewportRead(pane));
    const choice = VIEWPORT_VIEW_CHOICES_3D.find(
      (candidate) => candidate.shadingMode !== LAYOUT_CHROME_TEST_DEFAULT_SHADING,
    );
    if (!choice || choice.shadingMode === null) {
      throw new Error('No 3D choice with a non-default shading');
    }
    toolbar.getTitleElement().click();
    const row = Array.from(toolbar.getViewMenuPanel()?.getElement().querySelectorAll('button') ?? []).find((button) =>
      (button.textContent ?? '').trim().endsWith(choice.label),
    );
    if (!row) {
      throw new Error(`Menu row ${choice.label} missing`);
    }
    row.click();
    const viewport = layoutChromeTestViewportRead(pane);
    expect(pane.getKind()).toBe(ViewportKind.PERSPECTIVE);
    expect(viewport.getShadingMode()).toBe(choice.shadingMode);
    expect(viewport.getViewportToolbar().getActiveShadingMode()).toBe(choice.shadingMode);
  });
});
