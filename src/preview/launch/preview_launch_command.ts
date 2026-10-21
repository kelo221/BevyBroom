/** A program the game preview is started with. */
export interface PreviewLaunchCommand {
  /** Program to run, resolved through PATH when it is not a path. */
  program: string;
  /** Arguments passed to the program. */
  arguments: string[];
  /** Absolute directory the program runs in. */
  workingDirectory: string;
  /** Bridge endpoint the editor connects to. */
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
  return {
    program: previewLaunchStringRead(preview, 'program'),
    arguments: previewLaunchArgumentsRead(preview),
    workingDirectory: previewLaunchDirectoryJoin(
      projectDirectory,
      previewLaunchOptionalStringRead(preview, 'working_directory') ?? '.',
    ),
    endpoint: previewLaunchOptionalStringRead(preview, 'endpoint') ?? '',
  };
}

/**
 * Parses project text into an object.
 *
 * @param projectJson Text of the project file.
 * @returns Parsed project object.
 */
function previewLaunchProjectParse(projectJson: string): Record<string, unknown> {
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
function previewLaunchSectionRead(project: Record<string, unknown>): Record<string, unknown> {
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
 * @returns Field value.
 */
function previewLaunchStringRead(section: Record<string, unknown>, key: string): string {
  const value = previewLaunchOptionalStringRead(section, key);
  if (value === null) {
    throw new PreviewLaunchCommandError(`preview.${key} must be a non-empty string`);
  }
  return value;
}

/**
 * Returns an optional non-empty string field.
 *
 * @param section Object holding the field.
 * @param key Field name.
 * @returns Field value, or null when absent or empty.
 */
function previewLaunchOptionalStringRead(section: Record<string, unknown>, key: string): string | null {
  const value = section[key];
  if (value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new PreviewLaunchCommandError(`preview.${key} must be a string`);
  }
  return value.trim() === '' ? null : value;
}

/**
 * Returns the argument list of the preview section.
 *
 * @param section Preview section.
 * @returns Arguments, empty when absent.
 */
function previewLaunchArgumentsRead(section: Record<string, unknown>): string[] {
  const value = section['arguments'] ?? [];
  if (!Array.isArray(value) || !value.every((argument) => typeof argument === 'string')) {
    throw new PreviewLaunchCommandError('preview.arguments must be a list of strings');
  }
  return [...value];
}

/**
 * Resolves a working directory against the project directory.
 *
 * @param projectDirectory Absolute project directory.
 * @param workingDirectory Absolute or project-relative directory.
 * @returns Absolute directory with forward slashes and no trailing slash.
 */
function previewLaunchDirectoryJoin(projectDirectory: string, workingDirectory: string): string {
  const normalizedWorking = workingDirectory.replace(/\\/g, '/');
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
function previewLaunchIsRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
