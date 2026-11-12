/** Operating system family the editor runs on. */
export type PlatformKind = 'mac' | 'windows' | 'linux' | 'other';

/**
 * Reads the operating system family from a browser user agent string. Test DOMs
 * such as jsdom report the host operating system without a real browser
 * platform token and therefore read as other.
 *
 * @param userAgent Browser user agent string.
 * @returns Operating system family.
 */
export function platformKindFromUserAgent(userAgent: string): PlatformKind {
  if (/\bjsdom\//.test(userAgent)) {
    return 'other';
  }
  if (/Macintosh|Mac OS X/.test(userAgent)) {
    return 'mac';
  }
  if (/Windows/.test(userAgent)) {
    return 'windows';
  }
  return /Linux|X11/.test(userAgent) ? 'linux' : 'other';
}

/**
 * Reads the operating system family of the current browser, or other when no
 * browser navigator exists.
 *
 * @returns Operating system family.
 */
export function platformKindRead(): PlatformKind {
  if (typeof navigator === 'undefined') {
    return 'other';
  }
  return platformKindFromUserAgent(navigator.userAgent);
}

/**
 * Returns whether the current browser runs on macOS.
 *
 * @returns True on macOS.
 */
export function platformIsMac(): boolean {
  return platformKindRead() === 'mac';
}
