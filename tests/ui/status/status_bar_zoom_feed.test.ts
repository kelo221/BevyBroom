import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { StatusBarZoomFeed } from '@/ui/status/status_bar_zoom_feed.js';

/** Half height of the startup framing used by the tests. */
const STATUS_BAR_ZOOM_FEED_TEST_HALF_EXTENT = 4;

/**
 * Creates an orthographic camera framing a half height.
 *
 * @param halfHeight Visible half height before zooming.
 * @returns Orthographic camera.
 */
function statusBarZoomFeedTestCameraCreate(halfHeight: number): THREE.OrthographicCamera {
  return new THREE.OrthographicCamera(-halfHeight, halfHeight, halfHeight, -halfHeight, 0.1, 100);
}

describe('StatusBarZoomFeed', () => {
  it('reports a zoom of one at the startup framing', () => {
    const target = { setViewZoom: vi.fn() };
    const feed = new StatusBarZoomFeed(target, STATUS_BAR_ZOOM_FEED_TEST_HALF_EXTENT);
    feed.cameraRead(statusBarZoomFeedTestCameraCreate(STATUS_BAR_ZOOM_FEED_TEST_HALF_EXTENT));
    expect(target.setViewZoom).toHaveBeenCalledOnce();
    expect(target.setViewZoom.mock.calls[0]?.[0]).toBeCloseTo(1);
  });

  it('grows the zoom when the camera zooms in or frames a smaller area', () => {
    const target = { setViewZoom: vi.fn() };
    const feed = new StatusBarZoomFeed(target, STATUS_BAR_ZOOM_FEED_TEST_HALF_EXTENT);
    const camera = statusBarZoomFeedTestCameraCreate(STATUS_BAR_ZOOM_FEED_TEST_HALF_EXTENT);
    const cameraZoom = 3;
    camera.zoom = cameraZoom;
    feed.cameraRead(camera);
    expect(target.setViewZoom.mock.calls[0]?.[0]).toBeCloseTo(cameraZoom);
    const framingShrink = 2;
    feed.cameraRead(statusBarZoomFeedTestCameraCreate(STATUS_BAR_ZOOM_FEED_TEST_HALF_EXTENT / framingShrink));
    expect(target.setViewZoom.mock.calls[1]?.[0]).toBeCloseTo(framingShrink);
  });

  it('writes only when the zoom changes', () => {
    const target = { setViewZoom: vi.fn() };
    const feed = new StatusBarZoomFeed(target, STATUS_BAR_ZOOM_FEED_TEST_HALF_EXTENT);
    const camera = statusBarZoomFeedTestCameraCreate(STATUS_BAR_ZOOM_FEED_TEST_HALF_EXTENT);
    feed.cameraRead(camera);
    feed.cameraRead(camera);
    expect(target.setViewZoom).toHaveBeenCalledOnce();
    camera.zoom *= 2;
    feed.cameraRead(camera);
    expect(target.setViewZoom).toHaveBeenCalledTimes(2);
  });

  it('keeps the last 2D zoom while the pointer is over a perspective view or no view', () => {
    const target = { setViewZoom: vi.fn() };
    const feed = new StatusBarZoomFeed(target, STATUS_BAR_ZOOM_FEED_TEST_HALF_EXTENT);
    feed.cameraRead(statusBarZoomFeedTestCameraCreate(STATUS_BAR_ZOOM_FEED_TEST_HALF_EXTENT));
    feed.cameraRead(new THREE.PerspectiveCamera());
    feed.cameraRead(null);
    expect(target.setViewZoom).toHaveBeenCalledOnce();
  });

  it('ignores a degenerate orthographic frustum', () => {
    const target = { setViewZoom: vi.fn() };
    const feed = new StatusBarZoomFeed(target, STATUS_BAR_ZOOM_FEED_TEST_HALF_EXTENT);
    feed.cameraRead(statusBarZoomFeedTestCameraCreate(0));
    expect(target.setViewZoom).not.toHaveBeenCalled();
  });
});
