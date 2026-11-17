/**
 * The part of jsdom the command-line level export uses to stand in for a
 * browser.
 */
declare module 'jsdom' {
  /** Options of a jsdom document. */
  interface JSDOMOptions {
    pretendToBeVisual?: boolean;
    url?: string;
    virtualConsole?: VirtualConsole;
  }

  /** Where a jsdom window's console and errors go; nowhere until told. */
  export class VirtualConsole {}

  /** A document with its own window, without a browser. */
  export class JSDOM {
    constructor(html: string, options?: JSDOMOptions);
    readonly window: Window & typeof globalThis;
  }
}
