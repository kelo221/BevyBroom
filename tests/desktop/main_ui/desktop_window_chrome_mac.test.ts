import { describe, expect, it } from 'vitest';
import {
  DESKTOP_WINDOW_CHROME_MAC_STYLE_ELEMENT_ID,
  DESKTOP_WINDOW_CHROME_MAC_TRAFFIC_LIGHT_INSET_PX,
  desktopWindowChromeMacInstall,
} from '@/desktop/main_ui/desktop_window_chrome_mac.js';

describe('desktopWindowChromeMacInstall', () => {
  it('reserves room for the window buttons and makes the toolbar row drag the window', () => {
    const targetDocument = document.implementation.createHTMLDocument('chrome');
    desktopWindowChromeMacInstall(targetDocument);
    desktopWindowChromeMacInstall(targetDocument);
    const styles = targetDocument.querySelectorAll(`#${DESKTOP_WINDOW_CHROME_MAC_STYLE_ELEMENT_ID}`);
    expect(styles).toHaveLength(1);
    const cssText = styles[0]?.textContent ?? '';
    expect(cssText).toContain(`padding-left: ${DESKTOP_WINDOW_CHROME_MAC_TRAFFIC_LIGHT_INSET_PX}px`);
    expect(cssText).toContain('-webkit-app-region: drag');
    expect(cssText).toContain('-webkit-app-region: no-drag');
    expect(targetDocument.documentElement.dataset['windowChrome']).toBe('mac_inset');
  });
});
