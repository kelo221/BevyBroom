import { afterEach, describe, expect, it } from 'vitest';
import {
  AUDIO_SETTINGS_STORAGE_KEY,
  AudioSettings,
  createDefaultAudioSettings,
  loadAudioSettings,
} from '@/audio/settings/audio_settings.js';
import { notificationFrameEvents } from '@/audio/notification/notification_frame_events.js';
import { MemorySettingsStorage } from '@/settings/storage/settings_storage.js';
import {
  allowEditorStorageWritesForTests,
  suppressEditorStorageWrites,
} from '@/settings/storage/clear_editor_storage.js';

afterEach(() => {
  allowEditorStorageWritesForTests();
  notificationFrameEvents.reset();
});

describe('AudioSettings', () => {
  it('starts disabled until the user turns audio on', () => {
    expect(createDefaultAudioSettings().enabled).toBe(false);
    const settings = new AudioSettings(new MemorySettingsStorage());
    expect(settings.isEnabled()).toBe(false);
  });

  it('keeps a saved choice and treats a stored value without the flag as off', () => {
    const storage = new MemorySettingsStorage();
    new AudioSettings(storage).setEnabled(true);
    expect(new AudioSettings(storage).isEnabled()).toBe(true);
    storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, '{}');
    expect(loadAudioSettings(storage).enabled).toBe(false);
  });

  it('persists toggle across reload from storage', () => {
    const storage = new MemorySettingsStorage();
    const settings = new AudioSettings(storage);
    settings.setEnabled(false);
    expect(loadAudioSettings(storage).enabled).toBe(false);
    const reloaded = new AudioSettings(storage);
    expect(reloaded.isEnabled()).toBe(false);
  });

  it('toggle flips enabled and returns the new state', () => {
    const settings = new AudioSettings(new MemorySettingsStorage());
    expect(settings.toggle()).toBe(true);
    expect(settings.isEnabled()).toBe(true);
    expect(settings.toggle()).toBe(false);
  });

  it('clears frame-event flags when disabled or re-enabled', () => {
    const settings = new AudioSettings(new MemorySettingsStorage());
    settings.setEnabled(true);
    notificationFrameEvents.raiseSelectionMovedWithSnapping();
    notificationFrameEvents.beginFrame();
    expect(notificationFrameEvents.hasAnySnapFeedbackSnapshot()).toBe(true);
    settings.setEnabled(false);
    expect(notificationFrameEvents.hasAnySnapFeedbackSnapshot()).toBe(false);
    notificationFrameEvents.raiseSelectionMovedWithSnapping();
    notificationFrameEvents.beginFrame();
    settings.setEnabled(true);
    expect(notificationFrameEvents.hasAnySnapFeedbackSnapshot()).toBe(false);
  });

  it('skips writes when editor storage is suppressed', () => {
    const storage = new MemorySettingsStorage();
    const settings = new AudioSettings(storage);
    suppressEditorStorageWrites();
    settings.setEnabled(false);
    expect(storage.getItem(AUDIO_SETTINGS_STORAGE_KEY)).toBeNull();
  });
});
