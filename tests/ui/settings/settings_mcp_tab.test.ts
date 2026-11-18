import { afterEach, describe, expect, it } from 'vitest';
import { SettingsMcpTab } from '@/ui/settings/settings_mcp_tab.js';
import { settingsMcpTestBridgeCreate, settingsMcpTestServicesCreate } from './settings_mcp_test_support.js';

/** URL the test MCP server runs on. */
const SETTINGS_MCP_TEST_URL = 'http://127.0.0.1:18765/mcp';

/**
 * Finds a button of the page by its text.
 *
 * @param tab MCP page.
 * @param text Button text.
 * @returns Button.
 */
function buttonFind(tab: SettingsMcpTab, text: string): HTMLButtonElement {
  const button = [...tab.getElement().querySelectorAll('button')].find((candidate) => candidate.textContent === text);
  if (!button) throw new Error(`Button "${text}" not found`);
  return button;
}

/**
 * Reads the URL field of the page.
 *
 * @param tab MCP page.
 * @returns URL field value.
 */
function urlRead(tab: SettingsMcpTab): string {
  return tab.getElement().querySelector<HTMLInputElement>('[data-mcp-field="mcp-url"]')?.value ?? '';
}

/**
 * Waits until queued promise callbacks ran.
 *
 * @returns Promise settled afterwards.
 */
async function promisesFlush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('SettingsMcpTab', () => {
  it('says the server is desktop only in the browser build', async () => {
    const services = settingsMcpTestServicesCreate(null);
    const tab = new SettingsMcpTab(services);
    await tab.activate();
    expect(tab.getElement().textContent).toContain('unavailable in the browser build');
    expect(buttonFind(tab, 'Desktop only').disabled).toBe(true);
    expect(services.runningChanged).toHaveBeenLastCalledWith(false);
  });

  it('shows the URL of a running server and reports it as running', async () => {
    const services = settingsMcpTestServicesCreate(settingsMcpTestBridgeCreate(SETTINGS_MCP_TEST_URL, true));
    const tab = new SettingsMcpTab(services);
    await tab.activate();
    expect(urlRead(tab)).toBe(SETTINGS_MCP_TEST_URL);
    expect(tab.isServerRunning()).toBe(true);
    expect(services.runningChanged).toHaveBeenLastCalledWith(true);
    expect(tab.getElement().textContent).not.toContain('Token');
  });

  it('starts and stops the server from its button and clears the URL when stopped', async () => {
    const services = settingsMcpTestServicesCreate(settingsMcpTestBridgeCreate(SETTINGS_MCP_TEST_URL, false));
    const tab = new SettingsMcpTab(services);
    await tab.activate();
    buttonFind(tab, 'Start server').click();
    await promisesFlush();
    expect(urlRead(tab)).toBe(SETTINGS_MCP_TEST_URL);
    buttonFind(tab, 'Stop server').click();
    await promisesFlush();
    expect(tab.isServerRunning()).toBe(false);
    expect(urlRead(tab)).not.toBe(SETTINGS_MCP_TEST_URL);
    expect(services.statusShow).toHaveBeenLastCalledWith('MCP server stopped');
  });

  it('opens the AI Captures debug window from its Developer section', () => {
    const services = settingsMcpTestServicesCreate(null);
    const tab = new SettingsMcpTab(services);
    tab.getElement().querySelector<HTMLButtonElement>('[data-settings-action="ai-captures-open"]')?.click();
    expect(services.aiCapturesOpen).toHaveBeenCalledOnce();
  });

  it('refuses to copy before the server runs', async () => {
    const services = settingsMcpTestServicesCreate(settingsMcpTestBridgeCreate(SETTINGS_MCP_TEST_URL, false));
    const tab = new SettingsMcpTab(services);
    await tab.activate();
    buttonFind(tab, 'Copy URL').click();
    await promisesFlush();
    expect(services.statusShow).toHaveBeenLastCalledWith('Start the MCP server before copying the URL');
  });
});
