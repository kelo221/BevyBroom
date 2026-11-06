import * as THREE from 'three';
import { DEFAULT_ORTHO_HALF_EXTENT } from '@/types/editor_config.js';

/** Smallest zoom change that updates the status bar. */
const STATUS_ZOOM_FEED_EPSILON = 1e-4;

/** Status bar surface that shows the 2D view zoom. */
export interface StatusBarZoomTarget {
  /**
   * Shows the zoom factor of the 2D view, or the empty marker.
   *
   * @param zoom Zoom factor, or null when unknown.
   */
  setViewZoom(zoom: number | null): void;
}

/**
 * Feeds the zoom of the 2D view under the pointer into the status bar. The zoom
 * factor is 1 at the startup framing and grows when zooming in; the last 2D
 * zoom stays shown while the pointer is over a 3D view.
 */
export class StatusBarZoomFeed {
  private readonly target: StatusBarZoomTarget;
  private readonly startupHalfExtent: number;
  private lastZoom: number | null;

  /**
   * Creates a feed writing into a status bar.
   *
   * @param target Status bar that shows the zoom.
   * @param startupHalfExtent Orthographic half-height of the startup framing.
   */
  constructor(target: StatusBarZoomTarget, startupHalfExtent: number = DEFAULT_ORTHO_HALF_EXTENT) {
    this.target = target;
    this.startupHalfExtent = startupHalfExtent;
    this.lastZoom = null;
  }

  /**
   * Reads the zoom of a view camera and shows it when it changed. Cameras that
   * are not orthographic keep the last shown zoom.
   *
   * @param camera Camera of the view under the pointer, or null when none.
   */
  cameraRead(camera: THREE.Camera | null): void {
    if (!(camera instanceof THREE.OrthographicCamera)) {
      return;
    }
    const zoom = this.zoomOf(camera);
    if (zoom === null || (this.lastZoom !== null && Math.abs(zoom - this.lastZoom) < STATUS_ZOOM_FEED_EPSILON)) {
      return;
    }
    this.lastZoom = zoom;
    this.target.setViewZoom(zoom);
  }

  /**
   * Returns the zoom factor of an orthographic camera.
   *
   * @param camera Orthographic camera.
   * @returns Startup half-height divided by the visible half-height, or null
   *   when the frustum is degenerate.
   */
  private zoomOf(camera: THREE.OrthographicCamera): number | null {
    const halfHeight = (camera.top - camera.bottom) / 2 / camera.zoom;
    if (!Number.isFinite(halfHeight) || halfHeight <= 0) {
      return null;
    }
    return this.startupHalfExtent / halfHeight;
  }
}
