import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { Viewport2D } from '@/viewports/core/viewport_2d.js';
import { Viewport3D } from '@/viewports/core/viewport_3d.js';
import { MultiViewComposer, type MultiViewPanePass } from '@/viewports/core/multi_view_composer.js';
import type { RenderSurface, SurfaceRenderPane } from '@/viewports/shared/render_surface.js';

/**
 * Render surface stub that records the clear colors of the panes it is asked to
 * draw.
 */
class RenderSurfaceClearColorRecorder implements RenderSurface {
  readonly canvas = document.createElement('canvas');
  readonly workspaceElement = document.createElement('div');
  recordedPaneClearColors: number[] = [];
  recordedCanvasClearColor: number | null = null;

  /**
   * Returns no renderer; the composer never asks for it.
   *
   * @returns Placeholder renderer.
   */
  getRenderer(): THREE.WebGLRenderer {
    return null as unknown as THREE.WebGLRenderer;
  }

  /**
   * Returns the stub canvas.
   *
   * @returns Canvas element.
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Returns the stub workspace element.
   *
   * @returns Workspace element.
   */
  getWorkspaceElement(): HTMLElement {
    return this.workspaceElement;
  }

  /**
   * Returns a fixed drawable size.
   *
   * @returns Logical size.
   */
  getLogicalSize(): { width: number; height: number } {
    return { width: 640, height: 480 };
  }

  /**
   * Ignores resizes.
   *
   * @param _cssWidth Unused width.
   * @param _cssHeight Unused height.
   */
  resize(_cssWidth: number, _cssHeight: number): void {}

  /** Ignores workspace size syncs. */
  syncSizeFromWorkspace(): void {}

  /**
   * Records the canvas clear color and every pane clear color.
   *
   * @param _scene Unused scene.
   * @param panes Panes the composer built.
   * @param clearColor Full canvas clear color.
   */
  renderPanes(_scene: THREE.Scene, panes: readonly SurfaceRenderPane[], clearColor: number): void {
    this.recordedCanvasClearColor = clearColor;
    this.recordedPaneClearColors = panes.map((pane) => pane.clearColor);
  }

  /** Nothing to release. */
  dispose(): void {}
}

/**
 * Builds a multi-view pass that clears to a given color.
 *
 * @param clearColor Pane clear color.
 * @returns Pane pass.
 */
function panePassCreate(clearColor: number): MultiViewPanePass {
  return { camera: new THREE.PerspectiveCamera(), contentElement: document.createElement('div'), clearColor };
}

/** Unit tests for the per-pane clear colors of the 2D and 3D views. */
describe('viewport background colors', () => {
  it('clears the 2D views to the 2D background and the 3D view to the 3D background', () => {
    expect(Viewport2D.prototype.getBackgroundColor.call(Object.create(Viewport2D.prototype))).toBe(
      Theme.viewport2dBackground,
    );
    expect(Viewport3D.prototype.getBackgroundColor.call(Object.create(Viewport3D.prototype))).toBe(
      Theme.viewportBackground,
    );
    expect(Theme.viewport2dBackground).not.toBe(Theme.viewportBackground);
  });

  it('hands every pane its own clear color through the composer', () => {
    const surface = new RenderSurfaceClearColorRecorder();
    const composer = new MultiViewComposer(surface);
    const paneClearColors = [Theme.viewport2dBackground, Theme.viewportBackground, Theme.viewport2dBackground];
    composer.render(new THREE.Scene(), paneClearColors.map(panePassCreate));
    expect(surface.recordedPaneClearColors).toEqual(paneClearColors);
    expect(surface.recordedCanvasClearColor).toBe(Theme.separatorColor);
  });

  it('updates a reused pane slot when its clear color changes between frames', () => {
    const surface = new RenderSurfaceClearColorRecorder();
    const composer = new MultiViewComposer(surface);
    composer.render(new THREE.Scene(), [panePassCreate(Theme.viewport2dBackground)]);
    composer.render(new THREE.Scene(), [panePassCreate(Theme.viewportBackground)]);
    expect(surface.recordedPaneClearColors).toEqual([Theme.viewportBackground]);
  });
});
