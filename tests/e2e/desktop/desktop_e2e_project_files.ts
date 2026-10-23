import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PREVIEW_E2E_PROJECT_FILE_NAME, previewE2eProjectCopy } from '../preview_e2e_game_process.js';

/** Folder of the small crate the test project builds before it starts the game. */
export const DESKTOP_E2E_BUILD_CRATE_FOLDER = 'build_check';

/** Source file of the build crate, relative to the project directory. */
export const DESKTOP_E2E_BUILD_SOURCE_FILE = join(DESKTOP_E2E_BUILD_CRATE_FOLDER, 'src', 'main.rs');

/** Build crate source that compiles. */
const DESKTOP_E2E_BUILD_SOURCE_GOOD = 'fn main() {\n    println!("build check");\n}\n';

/** Build crate source with an error on line 2. */
const DESKTOP_E2E_BUILD_SOURCE_BROKEN =
  'fn main() {\n    let speed: u32 = missing_speed_value;\n    println!("{speed}");\n}\n';

/** What a test needs to know about a prepared game project. */
export interface DesktopE2eProject {
  directory: string;
  projectFile: string;
  projectIdentifier: string;
  endpoint: string;
}

/** How to prepare a game project. */
export interface DesktopE2eProjectOptions {
  sourceProjectDirectory: string;
  previewExecutable: string;
  projectIdentifier: string;
  bridgePort: number;
  isWindowShown: boolean;
}

/**
 * Copies the game project to a temporary directory, adds a small crate that is
 * built before every launch and points the launch at the preview program on a
 * private port.
 *
 * @param options Source project, program, project id, port and window choice.
 * @returns The prepared project.
 */
export function desktopE2eProjectPrepare(options: DesktopE2eProjectOptions): DesktopE2eProject {
  const directory = previewE2eProjectCopy(options.sourceProjectDirectory);
  desktopE2eBuildCrateWrite(directory);
  const endpoint = `http://127.0.0.1:${options.bridgePort}`;
  const projectFile = join(directory, PREVIEW_E2E_PROJECT_FILE_NAME);
  const project = JSON.parse(readFileSync(projectFile, 'utf8')) as Record<string, unknown>;
  project['project_id'] = options.projectIdentifier;
  project['preview'] = desktopE2ePreviewSectionBuild(options, endpoint);
  writeFileSync(projectFile, JSON.stringify(project, null, 2));
  return { directory, projectFile, projectIdentifier: options.projectIdentifier, endpoint };
}

/**
 * Builds the preview section: launch the preview program, build the crate
 * first.
 *
 * @param options Program, port and window choice.
 * @param endpoint Bridge endpoint of the game.
 * @returns Preview section of the project file.
 */
function desktopE2ePreviewSectionBuild(options: DesktopE2eProjectOptions, endpoint: string): Record<string, unknown> {
  const launchArguments = ['--project', PREVIEW_E2E_PROJECT_FILE_NAME, '--port', String(options.bridgePort)];
  if (!options.isWindowShown) {
    launchArguments.push('--hidden');
  }
  const manifest = join(DESKTOP_E2E_BUILD_CRATE_FOLDER, 'Cargo.toml');
  return {
    program: options.previewExecutable,
    arguments: launchArguments,
    working_directory: '.',
    endpoint,
    build: {
      program: 'cargo',
      arguments: ['build', '--manifest-path', manifest, '--message-format=short'],
      working_directory: '.',
    },
  };
}

/**
 * Writes the build crate with source that compiles.
 *
 * @param directory Project directory.
 */
function desktopE2eBuildCrateWrite(directory: string): void {
  const crateDirectory = join(directory, DESKTOP_E2E_BUILD_CRATE_FOLDER);
  mkdirSync(join(crateDirectory, 'src'), { recursive: true });
  const manifest = '[package]\nname = "broom_e2e_build_check"\nversion = "0.1.0"\nedition = "2021"\n\n[workspace]\n';
  writeFileSync(join(crateDirectory, 'Cargo.toml'), manifest);
  desktopE2eBuildSourceWrite(directory, true);
}

/**
 * Makes the build crate compile or fail.
 *
 * @param directory Project directory.
 * @param isCompiling True for source that compiles, false for source with an
 *   error.
 */
export function desktopE2eBuildSourceWrite(directory: string, isCompiling: boolean): void {
  const source = isCompiling ? DESKTOP_E2E_BUILD_SOURCE_GOOD : DESKTOP_E2E_BUILD_SOURCE_BROKEN;
  writeFileSync(join(directory, DESKTOP_E2E_BUILD_SOURCE_FILE), source);
}

/**
 * Returns whether a process with an id still runs.
 *
 * @param processId Process id.
 * @returns True while the process exists.
 */
export function desktopE2eProcessIsAlive(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch {
    return false;
  }
}
