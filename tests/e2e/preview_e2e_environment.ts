import { resolve } from 'node:path';

/** Bridge port used when BROOM_E2E_PORT is not set. */
const PREVIEW_E2E_DEFAULT_PORT = 15792;

/**
 * Returns whether BROOM_E2E_SHOW_WINDOWS asks the end-to-end tests to show the
 * windows of the programs they start; they stay hidden otherwise.
 *
 * @returns True when the windows should be shown.
 */
export function e2eWindowsShownRead(): boolean {
  return process.env['BROOM_E2E_SHOW_WINDOWS'] === '1';
}

/** Where the game preview end-to-end tests find the game and its project. */
export interface PreviewE2eEnvironment {
  /** Absolute path of the broom_preview executable, empty when unset. */
  previewExecutable: string;
  /** Absolute path of the project directory to copy, empty when unset. */
  sourceProjectDirectory: string;
  /** Bridge port of this test file's game. */
  bridgePort: number;
  /** Bridge endpoint URL of this test file's game. */
  endpoint: string;
  /** True when both the executable and the project directory are set. */
  isConfigured: boolean;
}

/**
 * Turns a configured path into an absolute one.
 *
 * @param configuredPath Path from the environment, possibly relative or unset.
 * @returns Absolute path, or an empty string when unset.
 */
function previewE2ePathResolveOrEmpty(configuredPath: string | undefined): string {
  return configuredPath ? resolve(configuredPath) : '';
}

/**
 * Reads BROOM_E2E_PREVIEW_EXE, BROOM_E2E_PROJECT_DIR and BROOM_E2E_PORT. Each
 * test file passes its own port offset so files that run at the same time start
 * their games on different ports.
 *
 * @param portOffset Offset added to the configured base port.
 * @returns The environment of one test file.
 */
export function previewE2eEnvironmentRead(portOffset: number): PreviewE2eEnvironment {
  const previewExecutable = previewE2ePathResolveOrEmpty(process.env['BROOM_E2E_PREVIEW_EXE']);
  const sourceProjectDirectory = previewE2ePathResolveOrEmpty(process.env['BROOM_E2E_PROJECT_DIR']);
  const bridgePort = Number(process.env['BROOM_E2E_PORT'] ?? PREVIEW_E2E_DEFAULT_PORT) + portOffset;
  const isConfigured = previewExecutable !== '' && sourceProjectDirectory !== '';
  e2eRequiredConfigurationAssert(isConfigured, ['BROOM_E2E_PREVIEW_EXE', 'BROOM_E2E_PROJECT_DIR']);
  return {
    previewExecutable,
    sourceProjectDirectory,
    bridgePort,
    endpoint: `http://127.0.0.1:${bridgePort}`,
    isConfigured,
  };
}

/**
 * Returns whether BROOM_E2E_REQUIRED asks every end-to-end suite to run, so a
 * missing program fails the run instead of skipping it.
 *
 * @returns True when skipping is not allowed.
 */
export function e2eRequiredRead(): boolean {
  return process.env['BROOM_E2E_REQUIRED'] === '1';
}

/**
 * Fails when end-to-end suites are required but their programs are not
 * configured.
 *
 * @param isConfigured Whether every variable the suite needs is set.
 * @param variableNames Variables the suite needs, named in the failure.
 * @throws Error naming the variables when the suite would otherwise be skipped.
 */
export function e2eRequiredConfigurationAssert(isConfigured: boolean, variableNames: readonly string[]): void {
  if (isConfigured || !e2eRequiredRead()) {
    return;
  }
  throw new Error(`BROOM_E2E_REQUIRED=1 but ${variableNames.join(' and ')} must be set; the suite would be skipped.`);
}
