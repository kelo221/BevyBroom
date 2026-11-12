import { DialogAbout } from '@/ui/about/dialog_about.js';
import { DialogSettings } from '@/ui/settings/dialog_settings.js';
import { EditorSettingsStore } from '@/settings/store/editor_settings_store.js';
import { SettingsApplicator } from '@/settings/store/settings_applicator.js';
import { performEditorFactoryReset } from '@/settings/storage/clear_editor_storage.js';
import {
  MOUSE_SENSITIVITY_MAX,
  type EditorSettingsSnapshot,
  type MouseSettings,
  type ViewSettings,
} from '@/settings/store/settings_types.js';
import { getTextureMapCache } from '@/texture/library/texture_map_cache.js';
import { createTextureFilterPolicy } from '@/texture/library/policy_texture_filter.js';
import type { Viewport3D } from '@/viewports/core/viewport_3d.js';
import type { Viewport2D } from '@/viewports/core/viewport_2d.js';
import type { ViewportPaneLayout } from '@/layout/viewport/viewport_pane_layout.js';
import type { StatusBar } from '@/ui/status/status_bar.js';
import type { Toolbar } from '@/ui/toolbar/toolbar.js';
import type * as THREE from 'three';

/** Result of creating the settings store, applicator, and subscription. */
export interface LayoutSettingsSystemParts {
  settingsStore: EditorSettingsStore;
  settingsApplicator: SettingsApplicator;
  settingsUnsubscribe: () => void;
}

/** Host that can report WebGL max anisotropy for texture filter policy. */
export interface LayoutSettingsRendererHost {
  getRenderer(): THREE.WebGLRenderer;
}

/** Dependencies required to create and wire the settings subsystem. */
export interface LayoutSettingsCreateDeps {
  /**
   * Live perspective viewport when one exists. Read through a getter so
   * orthographic-only layouts (e.g. a single remaining 2D pane) do not crash
   * settings startup.
   */
  getPerspectiveViewport: () => Viewport3D | null;
  /**
   * Any live viewport that can report renderer capabilities for texture
   * filtering (2D or 3D).
   */
  getRendererHost: () => LayoutSettingsRendererHost | null;
  /** Live orthographic viewports that take the pan speed setting. */
  getOrthographicViewports: () => readonly Viewport2D[];
  viewportPaneLayout: ViewportPaneLayout;
  toolbar: Toolbar;
  resizeAll: () => void;
  onVisibleSlots?: (slots: readonly string[]) => void;
  /** Optional workspace-driven pane count migration (preferred over raw grid). */
  onViewportPaneCount?: (paneCount: 1 | 2 | 3 | 4) => void;
}

/**
 * Creates the settings store, applicator, and subscription, and applies every
 * snapshot to the editor; the viewport pane count is applied only when it
 * differs from the last applied count. Does not construct the settings dialog
 * so no modal DOM exists until the user opens Settings.
 *
 * @param deps Layout settings create dependencies.
 * @returns Owned settings subsystem parts.
 */
export function createLayoutSettingsSystem(deps: LayoutSettingsCreateDeps): LayoutSettingsSystemParts {
  const settingsStore = new EditorSettingsStore();
  const settingsApplicator = new SettingsApplicator(document.documentElement);
  let appliedPaneCount: ViewSettings['viewportPaneCount'] | null = null;
  const snapshotApply = (snapshot: EditorSettingsSnapshot): void => {
    settingsApplicator.applySnapshot(snapshot);
    deps.toolbar.setButtonLabelsEnabled(snapshot.view.toolbarButtonLabels);
    if (snapshot.view.viewportPaneCount !== appliedPaneCount) {
      appliedPaneCount = snapshot.view.viewportPaneCount;
      applyLayoutViewportPaneCountFromDeps(deps, appliedPaneCount);
    }
    applyLayoutViewportMouseSettings(deps, settingsStore, snapshot.mouse);
    applyLayoutTextureFilterSettings(deps.getRendererHost(), snapshot.view);
  };
  snapshotApply(settingsStore.getSnapshot());
  const settingsUnsubscribe = settingsStore.subscribe(snapshotApply);
  return { settingsStore, settingsApplicator, settingsUnsubscribe };
}

/**
 * Applies a pane count through the layout dependencies.
 *
 * @param deps Layout settings create dependencies.
 * @param paneCount Number of viewport panes to display.
 */
function applyLayoutViewportPaneCountFromDeps(
  deps: LayoutSettingsCreateDeps,
  paneCount: ViewSettings['viewportPaneCount'],
): void {
  applyLayoutViewportPaneCount(
    deps.viewportPaneLayout,
    deps.resizeAll,
    paneCount,
    deps.onVisibleSlots,
    deps.onViewportPaneCount,
  );
}

/**
 * Applies the mouse settings to the perspective and orthographic viewports and
 * keeps the wheel fly speed written back to the store.
 *
 * @param deps Layout settings create dependencies.
 * @param settingsStore Store that receives the wheel fly speed.
 * @param mouse Current mouse settings snapshot.
 */
function applyLayoutViewportMouseSettings(
  deps: LayoutSettingsCreateDeps,
  settingsStore: EditorSettingsStore,
  mouse: MouseSettings,
): void {
  const perspectiveViewport = deps.getPerspectiveViewport();
  applyFlyingCameraMouseSettings(perspectiveViewport, mouse);
  bindFlyingCameraMoveSpeedWriteBack(perspectiveViewport, settingsStore);
  applyOrthographicPanMouseSettings(deps.getOrthographicViewports(), mouse);
}

/**
 * Converts the pan sensitivity setting to the orthographic pan speed factor.
 *
 * @param panSensitivity Pan sensitivity in the mouse sensitivity range.
 * @returns Fraction of the pointer travel the view pans by.
 */
export function panSpeedFactorFromSensitivity(panSensitivity: number): number {
  return panSensitivity / MOUSE_SENSITIVITY_MAX;
}

/**
 * Applies the pan sensitivity and the wheel preference to every orthographic
 * viewport.
 *
 * @param viewports Live orthographic viewports.
 * @param mouse Current mouse settings snapshot.
 */
export function applyOrthographicPanMouseSettings(viewports: readonly Viewport2D[], mouse: MouseSettings): void {
  const factor = panSpeedFactorFromSensitivity(mouse.panSensitivity);
  for (const viewport of viewports) {
    viewport.setPanSpeedFactor(factor);
    viewport.setWheelPreference(mouse.wheelIn2dViews);
  }
}

/**
 * Writes the fly speed the wheel sets during right-button look back to the
 * mouse move speed setting.
 *
 * @param viewport Perspective viewport or null.
 * @param settingsStore Store that persists the move speed.
 */
export function bindFlyingCameraMoveSpeedWriteBack(
  viewport: Viewport3D | null,
  settingsStore: EditorSettingsStore,
): void {
  viewport?.setFlyingCameraMoveSpeedChangedListener((moveSpeed) => settingsStore.updateMouseSettings({ moveSpeed }));
}

/**
 * Creates the settings dialog when the user first opens Settings.
 *
 * @param container Editor root element that owns the modal overlay.
 * @param store Shared editor settings store.
 * @returns Settings dialog instance (hidden until shown).
 */
export function createLayoutSettingsDialog(container: HTMLElement, store: EditorSettingsStore): DialogSettings {
  return new DialogSettings(container, store, {
    onResetAllSettings: () => {
      runEditorFactoryResetAndReload();
    },
  });
}

/**
 * Wipes every editor-owned preference (settings, workspaces, profiles, etc.),
 * blocks unload re-persistence, and reloads so code defaults take effect.
 * Nothing from the previous session is allowed to write back.
 */
export function runEditorFactoryResetAndReload(): void {
  performEditorFactoryReset();
  window.location.reload();
}

/**
 * Applies flying-camera move speed when a perspective viewport is present.
 *
 * @param viewport Perspective viewport or null.
 * @param moveSpeed Move speed from mouse settings.
 */
export function applyFlyingCameraMoveSpeed(viewport: Viewport3D | null, moveSpeed: number): void {
  viewport?.setFlyingCameraMoveSpeed(moveSpeed);
}

/**
 * Applies the mouse settings that drive the 3D flying camera when a perspective
 * viewport is present.
 *
 * @param viewport Perspective viewport or null.
 * @param mouse Current mouse settings snapshot.
 */
export function applyFlyingCameraMouseSettings(viewport: Viewport3D | null, mouse: MouseSettings): void {
  applyFlyingCameraMoveSpeed(viewport, mouse.moveSpeed);
  viewport?.setFlyingCameraAltMiddleDragDolly(mouse.altMiddleMouseDragMovesCamera, mouse.invertAltMiddleMouseDragZAxis);
}

/**
 * Applies view texture filter preferences to the shared content map cache.
 *
 * @param rendererHost Viewport providing WebGL max anisotropy, or null.
 * @param view Current view settings snapshot.
 */
export function applyLayoutTextureFilterSettings(
  rendererHost: LayoutSettingsRendererHost | null,
  view: ViewSettings,
): void {
  if (!rendererHost) return;
  const maxAnisotropy = rendererHost.getRenderer().capabilities.getMaxAnisotropy();
  const policy = createTextureFilterPolicy(view.textureFilterMode, view.anisotropyPreference, maxAnisotropy);
  getTextureMapCache().setFilterPolicy(policy);
}

/**
 * Applies a pane count preference and updates visible viewport render sizes.
 *
 * @param viewportPaneLayout Pane layout controller.
 * @param resizeAll Resize callback after layout settles.
 * @param paneCount Number of viewport panes to display.
 * @param onVisibleSlots Optional callback with visible slot names for
 *   active-set sync.
 * @param onViewportPaneCount Optional workspace-driven pane count migration.
 */
export function applyLayoutViewportPaneCount(
  viewportPaneLayout: ViewportPaneLayout,
  resizeAll: () => void,
  paneCount: 1 | 2 | 3 | 4,
  onVisibleSlots?: (slots: readonly string[]) => void,
  onViewportPaneCount?: (paneCount: 1 | 2 | 3 | 4) => void,
): void {
  if (onViewportPaneCount) {
    onViewportPaneCount(paneCount);
  } else {
    viewportPaneLayout.apply(paneCount);
    onVisibleSlots?.(viewportPaneLayout.getVisibleSlots());
  }
  requestAnimationFrame(() => resizeAll());
}

/**
 * Opens the About dialog, creating it when missing.
 *
 * @param container Editor root element.
 * @param existingDialog Existing dialog instance or null.
 * @param statusBar Optional status bar for action text.
 * @returns Dialog instance that was shown.
 */
export function openLayoutAboutDialog(
  container: HTMLElement,
  existingDialog: DialogAbout | null,
  statusBar: StatusBar | null,
): DialogAbout {
  const aboutDialog = existingDialog ?? new DialogAbout(container);
  aboutDialog.show();
  statusBar?.setLastAction('About BevyBroom');
  return aboutDialog;
}
