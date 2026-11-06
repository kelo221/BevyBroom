import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SettingsApplicator } from '@/settings/store/settings_applicator.js';
import {
  createDefaultKeyboardShortcutSettings,
  createDefaultMouseSettings,
  createDefaultViewSettings,
} from '@/settings/store/settings_defaults.js';
import type { EditorSettingsSnapshot } from '@/settings/store/settings_types.js';
import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';

describe('SettingsApplicator', () => {
  let root: HTMLElement;
  let applicator: SettingsApplicator;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    applicator = new SettingsApplicator(root);
  });

  afterEach(() => {
    applicator.dispose();
    root.remove();
  });

  it('should apply theme brightness font size and icon scale to the root', () => {
    const snapshot: EditorSettingsSnapshot = {
      activeGameProfileId: null,
      gameProfiles: [],
      customCoordinateSpaces: [],
      view: {
        ...createDefaultViewSettings(),
        theme: 'light',
        brightness: 125,
        rendererFontSize: 16,
        materialBrowserIconSizePercent: 150,
      },
      mouse: createDefaultMouseSettings(),
      update: { automaticChecks: true },
      keyboard: createDefaultKeyboardShortcutSettings(),
    };
    applicator.applySnapshot(snapshot);
    expect(root.getAttribute('data-bevybroom-theme')).toBe('light');
    expect(root.style.getPropertyValue('--bevybroom-viewport-brightness')).toBe('1.25');
    expect(root.style.fontSize).toBe('16px');
    expect(root.style.getPropertyValue('--bevybroom-material-icon-scale')).toBe('1.5');
  });

  it('should resolve dark theme preference directly', () => {
    applicator.applyTheme('dark');
    expect(root.getAttribute('data-bevybroom-theme')).toBe('dark');
  });

  it('should install the classic light palette from the theme tokens', () => {
    applicator.applySnapshot({
      activeGameProfileId: null,
      gameProfiles: [],
      customCoordinateSpaces: [],
      view: { ...createDefaultViewSettings(), theme: 'light' },
      mouse: createDefaultMouseSettings(),
      update: { automaticChecks: true },
      keyboard: createDefaultKeyboardShortcutSettings(),
    });
    const style = document.getElementById('bevybroom-view-settings-styles');
    expect(style?.textContent).toContain('--bevybroom-ui-font-size');
    expect(style?.textContent).toContain('--bevybroom-viewport-brightness');
    expect(style?.textContent).toContain('--bevybroom-material-icon-scale');
    expect(style?.textContent).toContain("data-bevybroom-theme='light'");
    expect(style?.textContent).toContain(`background: ${Theme.panelSunkenBackground} !important`);
    expect(style?.textContent).toContain(`background: ${Theme.panelBackground} !important`);
    expect(style?.textContent).toContain('.editor-toolbar');
    expect(style?.textContent).toContain('.editor-properties-panel');
    expect(style?.textContent).toContain('.editor-status-bar *');
    expect(style?.textContent).toContain('.editor-context-menu');
    expect(style?.textContent).toContain('.editor-context-menu-item:hover');
    expect(style?.textContent).toContain('.editor-context-menu-item-disabled');
    expect(style?.textContent).toContain('.settings-dialog-header');
    expect(style?.textContent).toContain('.settings-dialog-content');
    expect(style?.textContent).toContain('.settings-dialog-category');
    expect(style?.textContent).toContain("[data-settings-field='coordinate-space-summary']");
    expect(style?.textContent).toContain(`color: ${Theme.secondaryTextColor} !important`);
    expect(style?.textContent).toContain(`background: ${hexToRgb(Theme.buttonHoverColor)} !important`);
    expect(style?.textContent).toContain(`color: ${Theme.buttonTextColor} !important`);
    expect(style?.textContent).toContain(`border-color: ${Theme.focusOutline} !important`);
    expect(style?.textContent).toContain(`background: ${Theme.listSelectedBackground} !important`);
    expect(style?.textContent).toContain(`background: ${Theme.menuHighlightBackground} !important`);
    expect(style?.textContent).toContain(`color: ${Theme.menuHighlightTextColor} !important`);
    expect(style?.textContent).toContain('.settings-dialog-panel');
    expect(style?.textContent).not.toContain("[role='dialog']");
    expect(style?.textContent).not.toContain('.tb-browser-root');
    expect(style?.textContent).toContain(".tb-browser-tile[aria-selected='true']");
  });
});
