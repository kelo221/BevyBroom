import { describe, expect, it } from 'vitest';
import { platformReportBuild } from '@/platform/report/platform_report.js';
import { createDefaultKeyboardShortcutSettings } from '@/settings/store/settings_defaults.js';

/** Default binding that deletes the selection. */
const PLATFORM_REPORT_TEST_DELETE = createDefaultKeyboardShortcutSettings().delete_selected;

describe('platformReportBuild', () => {
  it('lists more delete bindings on macOS than the configured one, because Mac keyboards lack Delete', () => {
    const macReport = platformReportBuild({
      platform: 'mac',
      themeLook: 'mac_glass',
      deleteSelectionShortcut: PLATFORM_REPORT_TEST_DELETE,
    });
    expect(macReport.deleteSelectionShortcuts.length).toBeGreaterThan(1);
    expect(macReport.deleteSelectionShortcuts).toContain('⌫');
    expect(macReport).toMatchObject({ platform: 'mac', themeLook: 'mac_glass' });
  });

  it('keeps exactly the configured delete binding on Windows', () => {
    const windowsReport = platformReportBuild({
      platform: 'windows',
      themeLook: 'classic',
      deleteSelectionShortcut: PLATFORM_REPORT_TEST_DELETE,
    });
    expect(windowsReport.deleteSelectionShortcuts).toHaveLength(1);
    expect(windowsReport.deleteSelectionShortcuts.join(' ')).not.toMatch(/[⌫⌘]/);
  });
});
