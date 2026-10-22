/** A program the game preview is started or built with. */
export interface PreviewLaunchCommand {
  /** Program to run, resolved through PATH when it is not a path. */
  program: string;
  /** Arguments passed to the program. */
  arguments: string[];
  /** Absolute directory the program runs in. */
  workingDirectory: string;
  /** Bridge endpoint the editor connects to; empty for build commands. */
  endpoint: string;
}

/** Error raised when a project file cannot start a preview. */
export class PreviewLaunchCommandError extends Error {
  /**
   * Creates the error.
   *
   * @param message Human-readable reason.
   */
  constructor(message: string) {
    super(message);
    this.name = 'PreviewLaunchCommandError';
  }
}

/**
 * Reads the preview section of a project file.
 *
 * @param projectJson Text of the project file.
 * @param projectDirectory Absolute directory holding the project file, with
 *   forward or back slashes.
 * @returns The command that starts the preview.
 */
export function previewLaunchCommandFromProject(projectJson: string, projectDirectory: string): PreviewLaunchCommand {
  const preview = previewLaunchSectionRead(previewLaunchProjectParse(projectJson));
  return previewLaunchCommandFromSection(preview, projectDirectory, 'preview');
}

/**
 * Reads one command section: program, arguments, working directory and
 * endpoint.
 *
 * @param section Parsed command section.
 * @param projectDirectory Absolute directory holding the project file.
 * @param sectionPath Dotted name of the section, used in error messages.
 * @returns The command.
 */
export function previewLaunchCommandFromSection(
  section: Record<string, unknown>,
  projectDirectory: string,
  sectionPath: string,
): PreviewLaunchCommand {
  return {
    program: previewLaunchStringRead(section, 'program', sectionPath),
    arguments: previewLaunchArgumentsRead(section, sectionPath),
    workingDirectory: previewLaunchDirectoryJoin(
      projectDirectory,
      previewLaunchOptionalStringRead(section, 'working_directory', sectionPath) ?? '.',
    ),
    endpoint: previewLaunchOptionalStringRead(section, 'endpoint', sectionPath) ?? '',
  };
}

/**
 * Parses project text into an object.
 *
 * @param projectJson Text of the project file.
 * @returns Parsed project object.
 */
export function previewLaunchProjectParse(projectJson: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(projectJson);
  } catch (error) {
    throw new PreviewLaunchCommandError(`The project file is not valid JSON: ${String(error)}`);
  }
  if (!previewLaunchIsRecord(parsed)) {
    throw new PreviewLaunchCommandError('The project file must hold a JSON object');
  }
  return parsed;
}

/**
 * Returns the preview section of a project.
 *
 * @param project Parsed project object.
 * @returns The preview section.
 */
export function previewLaunchSectionRead(project: Record<string, unknown>): Record<string, unknown> {
  const preview = project['preview'];
  if (!previewLaunchIsRecord(preview)) {
    throw new PreviewLaunchCommandError('The project file has no "preview" section');
  }
  return preview;
}

/**
 * Returns a required non-empty string field.
 *
 * @param section Object holding the field.
 * @param key Field name.
 * @param sectionPath Dotted name of the section, used in error messages.
 * @returns Field value.
 */
export function previewLaunchStringRead(section: Record<string, unknown>, key: string, sectionPath: string): string {
  const value = previewLaunchOptionalStringRead(section, key, sectionPath);
  if (value === null) {
    throw new PreviewLaunchCommandError(`${sectionPath}.${key} must be a non-empty string`);
  }
  return value;
}

/**
 * Returns an optional non-empty string field.
 *
 * @param section Object holding the field.
 * @param key Field name.
 * @param sectionPath Dotted name of the section, used in error messages.
 * @returns Field value, or null when absent or empty.
 */
export function previewLaunchOptionalStringRead(
  section: Record<string, unknown>,
  key: string,
  sectionPath: string,
): string | null {
  const value = section[key];
  if (value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new PreviewLaunchCommandError(`${sectionPath}.${key} must be a string`);
  }
  return value.trim() === '' ? null : value;
}

/**
 * Returns the argument list of a command section.
 *
 * @param section Command section.
 * @param sectionPath Dotted name of the section, used in error messages.
 * @returns Arguments, empty when absent.
 */
function previewLaunchArgumentsRead(section: Record<string, unknown>, sectionPath: string): string[] {
  const value = section['arguments'] ?? [];
  if (!Array.isArray(value) || !value.every((argument) => typeof argument === 'string')) {
    throw new PreviewLaunchCommandError(`${sectionPath}.arguments must be a list of strings`);
  }
  return [...value];
}

/**
 * Resolves a directory against the project directory.
 *
 * @param projectDirectory Absolute project directory.
 * @param relativeOrAbsolute Absolute or project-relative directory.
 * @returns Absolute directory with forward slashes and no trailing slash.
 */
export function previewLaunchDirectoryJoin(projectDirectory: string, relativeOrAbsolute: string): string {
  const normalizedWorking = relativeOrAbsolute.replace(/\\/g, '/');
  const isAbsolute = /^([a-zA-Z]:)?\//.test(normalizedWorking);
  const joined = isAbsolute ? normalizedWorking : `${projectDirectory.replace(/\\/g, '/')}/${normalizedWorking}`;
  return previewLaunchPathNormalize(joined);
}

/**
 * Removes "." segments, resolves ".." segments and trailing slashes.
 *
 * @param path Forward-slash path.
 * @returns Normalized path.
 */
function previewLaunchPathNormalize(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '..' && segments.length > 1) {
      segments.pop();
    } else if (segment !== '.' && !(segment === '' && segments.length > 0)) {
      segments.push(segment);
    }
  }
  return segments.join('/') || '/';
}

/**
 * Returns whether a value is a plain JSON object.
 *
 * @param value Value to test.
 * @returns True for non-null, non-array objects.
 */
export function previewLaunchIsRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
