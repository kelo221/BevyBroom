import { JSDOM, VirtualConsole } from 'jsdom';

/** Browser globals the editor's scene code reads, taken from a jsdom window. */
const LEVEL_EXPORT_HEADLESS_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'Node',
  'HTMLElement',
  'HTMLCanvasElement',
  'HTMLImageElement',
  'HTMLInputElement',
  'HTMLDivElement',
  'Image',
  'ImageData',
  'Event',
  'CustomEvent',
  'KeyboardEvent',
  'MouseEvent',
  'DOMParser',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
] as const;

/**
 * Globals replaced even when the runtime has its own, because jsdom's must work
 * together.
 */
const LEVEL_EXPORT_HEADLESS_GLOBALS_REPLACED = ['Blob', 'FileReader'] as const;

/**
 * Gives a command-line process the browser globals the editor's scene, CSG and
 * GLB code needs, with no window and no GPU: a jsdom document. Install it
 * before importing any editor module.
 */
export class LevelExportHeadlessEnvironment {
  /** Installs the jsdom globals that the runtime does not have. */
  static install(): void {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      pretendToBeVisual: true,
      url: 'http://localhost/',
      virtualConsole: new VirtualConsole(),
    });
    const target = globalThis as Record<string, unknown>;
    const source = dom.window as unknown as Record<string, unknown>;
    for (const name of LEVEL_EXPORT_HEADLESS_GLOBALS) {
      target[name] ??= source[name];
    }
    for (const name of LEVEL_EXPORT_HEADLESS_GLOBALS_REPLACED) {
      target[name] = source[name];
    }
  }
}
