import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  applyFlyingCameraMouseSettings,
  applyFlyingCameraMoveSpeed,
  applyLayoutTextureFilterSettings,
  applyOrthographicPanMouseSettings,
  bindFlyingCameraMoveSpeedWriteBack,
  panSpeedFactorFromSensitivity,
  runEditorFactoryResetAndReload,
} from '@/layout/setup/layout_settings_system.js';
import type { Viewport3D } from '@/viewports/core/viewport_3d.js';
import type { Viewport2D } from '@/viewports/core/viewport_2d.js';
import { MOUSE_MOVE_SPEED_MAX, MOUSE_SENSITIVITY_MAX, type ViewSettings } from '@/settings/store/settings_types.js';
import { createDefaultMouseSettings } from '@/settings/store/settings_defaults.js';
import { EditorSettingsStore } from '@/settings/store/editor_settings_store.js';
import { MemorySettingsStorage } from '@/settings/storage/settings_storage.js';

/**
 * Calls a captured move speed listener, failing when none was registered.
 *
 * @param listener Listener captured from the viewport stub, or null.
 * @param moveSpeed Speed passed to the listener.
 */
function moveSpeedListenerCall(listener: ((moveSpeed: number) => void) | null, moveSpeed: number): void {
  expect(listener).not.toBeNull();
  listener?.(moveSpeed);
}
import {
  allowEditorStorageWritesForTests,
  areEditorStorageWritesSuppressed,
  EDITOR_STORAGE_KEY_PREFIX,
} from '@/settings/storage/clear_editor_storage.js';

afterEach(() => {
  allowEditorStorageWritesForTests();
  vi.unstubAllGlobals();
});

describe('layout_settings_system orthographic-only safety', () => {
  it('does not throw when applying flying camera speed without a perspective viewport', () => {
    expect(() => applyFlyingCameraMoveSpeed(null, 1.5)).not.toThrow();
  });

  it('applies flying camera speed when a perspective viewport is present', () => {
    const setFlyingCameraMoveSpeed = vi.fn();
    const viewport = { setFlyingCameraMoveSpeed } as unknown as Viewport3D;
    applyFlyingCameraMoveSpeed(viewport, 2.25);
    expect(setFlyingCameraMoveSpeed).toHaveBeenCalledWith(2.25);
  });

  it('forwards the Alt + middle drag mouse settings to the perspective viewport', () => {
    const setFlyingCameraMoveSpeed = vi.fn();
    const setFlyingCameraAltMiddleDragDolly = vi.fn();
    const viewport = { setFlyingCameraMoveSpeed, setFlyingCameraAltMiddleDragDolly } as unknown as Viewport3D;
    const mouse = {
      ...createDefaultMouseSettings(),
      altMiddleMouseDragMovesCamera: true,
      invertAltMiddleMouseDragZAxis: true,
    };
    applyFlyingCameraMouseSettings(viewport, mouse);
    expect(setFlyingCameraMoveSpeed).toHaveBeenCalledWith(mouse.moveSpeed);
    expect(setFlyingCameraAltMiddleDragDolly).toHaveBeenCalledWith(true, true);
    expect(() => applyFlyingCameraMouseSettings(null, mouse)).not.toThrow();
  });

  it('gives every orthographic viewport the pan speed factor of the pan sensitivity, half speed by default', () => {
    const setPanSpeedFactorFirst = vi.fn();
    const setPanSpeedFactorSecond = vi.fn();
    const setWheelPreference = vi.fn();
    const viewports = [
      { setPanSpeedFactor: setPanSpeedFactorFirst, setWheelPreference },
      { setPanSpeedFactor: setPanSpeedFactorSecond, setWheelPreference },
    ] as unknown as Viewport2D[];
    const defaults = createDefaultMouseSettings();
    applyOrthographicPanMouseSettings(viewports, defaults);
    expect(setPanSpeedFactorFirst).toHaveBeenCalledWith(0.5);
    expect(setPanSpeedFactorSecond).toHaveBeenCalledWith(0.5);
    applyOrthographicPanMouseSettings(viewports, { ...defaults, panSensitivity: MOUSE_SENSITIVITY_MAX });
    expect(setPanSpeedFactorFirst).toHaveBeenLastCalledWith(1);
    expect(panSpeedFactorFromSensitivity(defaults.panSensitivity / 2)).toBeCloseTo(0.25, 9);
    expect(() => applyOrthographicPanMouseSettings([], defaults)).not.toThrow();
  });

  it('gives every orthographic viewport the 2D view wheel preference, automatic by default', () => {
    const setWheelPreference = vi.fn();
    const viewports = [{ setPanSpeedFactor: vi.fn(), setWheelPreference }] as unknown as Viewport2D[];
    const defaults = createDefaultMouseSettings();
    applyOrthographicPanMouseSettings(viewports, defaults);
    expect(setWheelPreference).toHaveBeenCalledWith('auto');
    applyOrthographicPanMouseSettings(viewports, { ...defaults, wheelIn2dViews: 'pan' });
    expect(setWheelPreference).toHaveBeenLastCalledWith('pan');
  });

  it('writes the wheel fly speed of the perspective viewport back to the mouse move speed setting', () => {
    let moveSpeedListener: ((moveSpeed: number) => void) | null = null;
    const viewport = {
      setFlyingCameraMoveSpeedChangedListener: (listener: ((moveSpeed: number) => void) | null) => {
        moveSpeedListener = listener;
      },
    } as unknown as Viewport3D;
    const store = new EditorSettingsStore(new MemorySettingsStorage());
    const snapshots = vi.fn();
    store.subscribe(snapshots);
    bindFlyingCameraMoveSpeedWriteBack(viewport, store);
    const nextSpeed = (store.getMouseSettings().moveSpeed + MOUSE_MOVE_SPEED_MAX) / 2;
    moveSpeedListenerCall(moveSpeedListener, nextSpeed);
    expect(store.getMouseSettings().moveSpeed).toBe(nextSpeed);
    moveSpeedListenerCall(moveSpeedListener, nextSpeed);
    expect(snapshots).toHaveBeenCalledTimes(1);
    expect(() => bindFlyingCameraMoveSpeedWriteBack(null, store)).not.toThrow();
  });

  it('does not throw when applying texture filters without a renderer host', () => {
    const view = {
      textureFilterMode: 'linear',
      anisotropyPreference: 'off',
    } as unknown as ViewSettings;
    expect(() => applyLayoutTextureFilterSettings(null, view)).not.toThrow();
  });
});

describe('runEditorFactoryResetAndReload', () => {
  it('wipes editor keys, suppresses further writes, and reloads', () => {
    const values = new Map<string, string>();
    values.set(`${EDITOR_STORAGE_KEY_PREFIX}settings.workspaces`, '{"layout":"custom"}');
    values.set(`${EDITOR_STORAGE_KEY_PREFIX}settings.view`, '{}');
    const storage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => {
        values.delete(key);
      },
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const reload = vi.fn();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', storage);
    vi.stubGlobal('location', { reload });

    runEditorFactoryResetAndReload();

    expect(areEditorStorageWritesSuppressed()).toBe(true);
    expect(values.size).toBe(0);
    expect(reload).toHaveBeenCalledOnce();
  });
});
