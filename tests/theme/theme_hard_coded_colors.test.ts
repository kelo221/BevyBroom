import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/** One source path that may keep color literals, with the reason it may. */
interface ThemeHardCodedColorAllowance {
  pathPrefix: string;
  reason: string;
}

/** Repository-relative source root the scan walks. */
const THEME_SCAN_SOURCE_ROOT = 'src';

/**
 * Path prefix of the theme token files, which are the one home of chrome
 * colors.
 */
const THEME_SCAN_THEME_PREFIX = 'src/theme';

/**
 * Finds `#rgb(a)` / `#rrggbb(aa)` CSS hex colors, CSS color functions and
 * 0xRRGGBB numbers.
 */
const THEME_SCAN_COLOR_LITERAL_PATTERN =
  /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w])|\b(?:rgba?|hsla?)\(|\b0x[0-9a-fA-F]{6}\b/;

/** Matches lines that are comments, which may mention colors freely. */
const THEME_SCAN_COMMENT_LINE_PATTERN = /^\s*(?:\*|\/\/|\/\*)/;

/**
 * Sources allowed to keep color literals. Data colors are content, not chrome,
 * and must not follow the theme. The entries marked as concurrent work belong
 * to folders other editors are reshaping right now and are to be removed once
 * those folders take their colors from the theme.
 */
const THEME_HARD_CODED_COLOR_ALLOWANCES: readonly ThemeHardCodedColorAllowance[] = [
  { pathPrefix: 'src/utils/utils_color.ts', reason: 'color conversion helpers build CSS color strings' },
  { pathPrefix: 'src/materials/material_color_neutral.ts', reason: 'data: neutral white and black material tints' },
  { pathPrefix: 'src/texture/library/', reason: 'data: procedural texture generator colors' },
  { pathPrefix: 'src/light/model/', reason: 'data: light default colors and color clamps' },
  { pathPrefix: 'src/player/character/', reason: 'data: player figurine body colors' },
  { pathPrefix: 'src/player/collision/', reason: 'bit masks that look like color numbers' },
  { pathPrefix: 'src/terrain/terrain_generator.ts', reason: 'data: default terrain material color' },
  { pathPrefix: 'src/ai/client/editor_api_capture_', reason: 'data: fixed capture palette kept stable for AI' },
  { pathPrefix: 'src/entity_browser/ui/entity_browser_thumbnail.ts', reason: 'data: hashed hsl thumbnail hue' },
  { pathPrefix: 'src/ui/about/about_art_palette.ts', reason: 'art: about box header artwork' },
  { pathPrefix: 'src/preview/catalog/preview_catalog_entries.ts', reason: 'data: swatch icons built from game colors' },
  { pathPrefix: 'src/ui/icons/hammer/', reason: 'art: full color toolbar icons' },
];

/**
 * Lists every TypeScript file below a directory.
 *
 * @param directory Absolute directory to walk.
 * @param found Accumulator receiving absolute file paths.
 * @returns The accumulator.
 */
function themeScanSourceFilesList(directory: string, found: string[]): string[] {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      themeScanSourceFilesList(fullPath, found);
    } else if (entry.name.endsWith('.ts')) {
      found.push(fullPath);
    }
  }
  return found;
}

/**
 * Returns whether a repository-relative source path may keep color literals.
 *
 * @param relativePath Forward-slash path relative to the repository root.
 * @returns True for theme files and allowlisted paths.
 */
function themeScanPathIsAllowed(relativePath: string): boolean {
  if (relativePath.startsWith(THEME_SCAN_THEME_PREFIX)) {
    return true;
  }
  return THEME_HARD_CODED_COLOR_ALLOWANCES.some((allowance) => relativePath.startsWith(allowance.pathPrefix));
}

/**
 * Returns `path:line: text` for every non-comment line of a file that holds a
 * color literal.
 *
 * @param absolutePath Absolute file path.
 * @param relativePath Forward-slash path relative to the repository root.
 * @returns Offending line descriptions.
 */
function themeScanFileOffendersRead(absolutePath: string, relativePath: string): string[] {
  const offenders: string[] = [];
  fs.readFileSync(absolutePath, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (THEME_SCAN_COMMENT_LINE_PATTERN.test(line)) return;
      if (!THEME_SCAN_COLOR_LITERAL_PATTERN.test(line)) return;
      offenders.push(`${relativePath}:${index + 1}: ${line.trim()}`);
    });
  return offenders;
}

/**
 * Scans the source tree for color literals outside the theme and allowlist.
 *
 * @param repositoryRoot Absolute repository root.
 * @returns Offending line descriptions.
 */
function themeScanOffendersRead(repositoryRoot: string): string[] {
  return themeScanSourceFilesList(path.join(repositoryRoot, THEME_SCAN_SOURCE_ROOT), []).flatMap((absolutePath) => {
    const relativePath = path.relative(repositoryRoot, absolutePath).split(path.sep).join('/');
    return themeScanPathIsAllowed(relativePath) ? [] : themeScanFileOffendersRead(absolutePath, relativePath);
  });
}

/**
 * Returns whether an allowlist prefix still names a directory or at least one
 * file, so stale entries are noticed.
 *
 * @param repositoryRoot Absolute repository root.
 * @param pathPrefix Allowlist path prefix; a trailing slash names a directory.
 * @returns True when the prefix matches something on disk.
 */
function themeScanAllowancePathExists(repositoryRoot: string, pathPrefix: string): boolean {
  const absolutePrefix = path.join(repositoryRoot, pathPrefix);
  if (pathPrefix.endsWith('/')) {
    return fs.existsSync(absolutePrefix);
  }
  const parentDirectory = path.dirname(absolutePrefix);
  const baseName = path.basename(absolutePrefix);
  return fs.existsSync(parentDirectory) && fs.readdirSync(parentDirectory).some((name) => name.startsWith(baseName));
}

/** Source scan proving chrome colors come from the theme tokens. */
describe('Theme hard-coded colors', () => {
  const repositoryRoot = process.cwd();

  it('finds no color literals outside the theme and the documented allowlist', () => {
    expect(themeScanOffendersRead(repositoryRoot)).toEqual([]);
  });

  it('documents a reason for, and points at an existing path with, every allowlist entry', () => {
    THEME_HARD_CODED_COLOR_ALLOWANCES.forEach((allowance) => {
      expect(allowance.reason.length, allowance.pathPrefix).toBeGreaterThan(0);
      expect(themeScanAllowancePathExists(repositoryRoot, allowance.pathPrefix), allowance.pathPrefix).toBe(true);
    });
  });

  it('detects hex, CSS function and 0x color literals with the scan pattern', () => {
    expect(THEME_SCAN_COLOR_LITERAL_PATTERN.test("color: '#1a2b3c'")).toBe(true);
    expect(THEME_SCAN_COLOR_LITERAL_PATTERN.test("background: 'rgba(1, 2, 3, 0.5)'")).toBe(true);
    expect(THEME_SCAN_COLOR_LITERAL_PATTERN.test('color: 0x1a2b3c')).toBe(true);
    expect(THEME_SCAN_COLOR_LITERAL_PATTERN.test('color: Theme.selectionColor')).toBe(false);
    expect(THEME_SCAN_COMMENT_LINE_PATTERN.test(' * Uses #ffffff text.')).toBe(true);
  });
});
