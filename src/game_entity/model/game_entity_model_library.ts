import type * as THREE from 'three';
import { GlbSceneParser } from '@/io/glb/glb_scene_parser.js';
import type { ProjectFileReadResult } from '@/project/files/project_file_read_result.js';
import { base64ToBytes } from '@/utils/utils_base64.js';

/** Reads one model file of the open project by its asset-root-relative path. */
export type GameEntityModelReader = (path: string) => Promise<ProjectFileReadResult>;

/** Shows why a model could not be loaded. */
export type GameEntityModelFailureReport = (message: string) => void;

/**
 * Loads the models game entity markers are drawn with, once per path, through a
 * reader of the open project. A model is requested the first time it is asked
 * for; until it is ready nothing is returned. The generation changes whenever a
 * model becomes ready or the reader changes.
 */
export class GameEntityModelLibrary {
  /** Library the editor's markers use. */
  static readonly shared = new GameEntityModelLibrary();

  private reader: GameEntityModelReader | null = null;
  private failureReport: GameEntityModelFailureReport | null = null;
  private readonly templates = new Map<string, THREE.Group>();
  private readonly loads = new Map<string, Promise<void>>();
  private readonly failures = new Map<string, string>();
  private generationValue = 0;
  private readerEpochValue = 0;
  private readonly changeListeners = new Set<() => void>();

  /**
   * Forgets every model and reads new ones through another reader.
   *
   * @param reader Reader of the open project, or null when none is open.
   * @param failureReport Shows load failures, or null to keep them silent.
   */
  readerSet(reader: GameEntityModelReader | null, failureReport: GameEntityModelFailureReport | null = null): void {
    this.reader = reader;
    this.failureReport = failureReport;
    this.templates.clear();
    this.loads.clear();
    this.failures.clear();
    this.readerEpochValue += 1;
    this.changedNotify();
  }

  /**
   * Registers a callback run whenever a model becomes ready or the reader
   * changes.
   *
   * @param listener Change callback.
   * @returns Function that removes the callback.
   */
  changeListenerAdd(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  /**
   * Returns a number that changes only when the reader changes, so models
   * loaded through an older reader can be told apart.
   *
   * @returns Reader epoch.
   */
  readerEpoch(): number {
    return this.readerEpochValue;
  }

  /**
   * Returns a number that changes whenever a model becomes ready or the reader
   * changes.
   *
   * @returns Generation.
   */
  generation(): number {
    return this.generationValue;
  }

  /**
   * Returns the loaded model of a path, starting its load when it was never
   * requested.
   *
   * @param path Model path relative to the asset root.
   * @returns Model scene shared by every caller, or null until it is ready.
   */
  templateRead(path: string): THREE.Group | null {
    const template = this.templates.get(path);
    if (template !== undefined) {
      return template;
    }
    this.loadStart(path);
    return null;
  }

  /**
   * Returns why a model failed to load.
   *
   * @param path Model path relative to the asset root.
   * @returns Failure message, or null when it did not fail.
   */
  failureRead(path: string): string | null {
    return this.failures.get(path) ?? null;
  }

  /**
   * Waits until every requested model finished loading or failed.
   *
   * @returns Promise settling once no load is running.
   */
  async idle(): Promise<void> {
    await Promise.all(this.loads.values());
  }

  /**
   * Starts loading a model unless it is loading, failed or no reader is set.
   *
   * @param path Model path relative to the asset root.
   */
  private loadStart(path: string): void {
    const reader = this.reader;
    if (reader === null || this.loads.has(path)) {
      return;
    }
    this.loads.set(path, this.load(path, reader));
  }

  /**
   * Reads and parses a model, keeping the result only while the reader it was
   * read with is still the current one.
   *
   * @param path Model path relative to the asset root.
   * @param reader Reader the load uses.
   */
  private async load(path: string, reader: GameEntityModelReader): Promise<void> {
    try {
      const result = await reader(path);
      if (!result.ok) {
        this.failureRemember(path, reader, result.message);
        return;
      }
      const scene = await GlbSceneParser.parse(base64ToBytes(result.bytesBase64));
      this.templateRemember(path, reader, scene);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.failureRemember(path, reader, `Cannot load model "${path}": ${reason}`);
    }
  }

  /**
   * Keeps a loaded model when its reader is still current.
   *
   * @param path Model path relative to the asset root.
   * @param reader Reader the model was read with.
   * @param scene Parsed model scene.
   */
  private templateRemember(path: string, reader: GameEntityModelReader, scene: THREE.Group): void {
    if (reader !== this.reader) {
      return;
    }
    this.templates.set(path, scene);
    this.changedNotify();
  }

  /** Counts a change and tells every listener. */
  private changedNotify(): void {
    this.generationValue += 1;
    this.changeListeners.forEach((listener) => listener());
  }

  /**
   * Keeps and reports a load failure when its reader is still current.
   *
   * @param path Model path relative to the asset root.
   * @param reader Reader the load used.
   * @param message Failure message.
   */
  private failureRemember(path: string, reader: GameEntityModelReader, message: string): void {
    if (reader !== this.reader) {
      return;
    }
    this.failures.set(path, message);
    this.failureReport?.(message);
  }
}
