import type * as THREE from 'three';
import type { SolidBrushInstance } from './solid_brush_instance.js';
import { modifierStackCompile, modifierStackDerivedByRoot } from '@/modifier/stack/evaluate/modifier_stack_compile.js';
import { MODIFIER_STACK_SOURCE_ID_KEY } from '@/modifier/stack/evaluate/modifier_stack_copy.js';
import {
  modifierStackDerivedStructure,
  modifierStackRegrouped,
} from '@/modifier/stack/evaluate/modifier_stack_structure.js';

/** Dirty tracking calls the modifier outputs need from the rebuild pipeline. */
export interface SolidModelRebuildModifierHost {
  /** Returns whether the next compile is already a full one. */
  fullRebuildRequiredIs(): boolean;
  /** Requests a full compile. */
  markDirty(): void;
  /** Marks brushes for an incremental compile. */
  markBrushesDirty(brushIds: Iterable<string>): void;
  /** Returns brush ids of the last compile in CSG order. */
  getLastBrushOrder(): string[];
  /** Returns ids of brushes whose geometry touched a brush in the last compile. */
  getCachedTouchPeerIds(brushId: string): string[];
  /** Drops a brush from the compiler caches. */
  invalidateBrush(brushId: string): void;
}

/**
 * Runs the modifier volumes of one solid before each compile and keeps the
 * brushes they derive stable between compiles, so live rebuilds only recompile
 * the derived brushes that changed.
 */
export class SolidModelRebuildModifierOutputs {
  private compileRoot: THREE.Object3D | undefined;
  private derivedBrushesPublished: ReadonlyMap<string, SolidBrushInstance> = new Map();
  private derivedBrushesLast = new Map<string, SolidBrushInstance>();
  private derivedStructureLast = new Map<string, string>();

  /**
   * Creates the outputs tracker.
   *
   * @param host Dirty tracking of the owning rebuild pipeline.
   */
  constructor(private readonly host: SolidModelRebuildModifierHost) {}

  /**
   * Returns the evaluation list after every modifier volume ran: chamfered
   * stand-ins replace authored brushes and derived brushes are appended. Only
   * derived brushes that are new or were re-evaluated become dirty seeds;
   * vanished ones are invalidated like removed brushes.
   *
   * @param authored Authored evaluation list.
   * @param solidRoot Solid root, or undefined when the model has none.
   * @returns Instances for the compiler.
   */
  instancesAfterModifierVolumes(
    authored: SolidBrushInstance[],
    solidRoot: THREE.Object3D | undefined,
  ): SolidBrushInstance[] {
    if (!solidRoot) return authored;
    solidRoot.updateMatrixWorld(true);
    const result = modifierStackCompile(authored, solidRoot);
    this.compileRoot = result.root;
    this.derivedBrushesPublished = modifierStackDerivedByRoot.get(solidRoot) ?? new Map();
    this.derivedChangesMark(result.instances.slice(authored.length));
    this.bevelDirtyMark(result.extraDirtyBrushIds);
    return result.instances;
  }

  /**
   * Returns the hierarchy the compiler walks: the compile-only tree that holds
   * derived brushes, or undefined before the first compile.
   *
   * @returns Compile root, or undefined.
   */
  compileRootRead(): THREE.Object3D | undefined {
    return this.compileRoot;
  }

  /**
   * Finds a derived brush of the last compile.
   *
   * @param brushId Derived brush id.
   * @returns Derived brush, or undefined for authored ids.
   */
  derivedBrushFind(brushId: string): SolidBrushInstance | undefined {
    return this.derivedBrushesPublished.get(brushId);
  }

  /**
   * Returns whether the last compile produced any derived brush.
   *
   * @returns True when modifier outputs exist.
   */
  derivedActiveIs(): boolean {
    return this.derivedBrushesPublished.size > 0;
  }

  /**
   * Returns whether any derived brush of the last compile was copied from one
   * of the given authored brushes.
   *
   * @param brushIds Authored brush ids.
   * @returns True when at least one copy follows those brushes.
   */
  copyOfAnySourceIs(brushIds: ReadonlySet<string>): boolean {
    for (const derived of this.derivedBrushesPublished.values()) {
      const sourceId = derived.mesh?.userData[MODIFIER_STACK_SOURCE_ID_KEY];
      if (typeof sourceId === 'string' && brushIds.has(sourceId)) return true;
    }
    return false;
  }

  /**
   * Compares derived brushes with the previous compile by id and identity: a
   * volume whose cache was reused hands back the same instances, so only
   * re-evaluated or new ids become seeds and vanished ids are invalidated. When
   * a kept derived brush moved between CSG groups the whole solid recompiles.
   *
   * @param derived Derived brushes of this compile.
   */
  private derivedChangesMark(derived: readonly SolidBrushInstance[]): void {
    const previous = this.derivedBrushesLast;
    this.derivedBrushesLast = new Map(derived.map((brush) => [brush.id, brush]));
    const structure = modifierStackDerivedStructure(derived);
    const regrouped = modifierStackRegrouped(this.derivedStructureLast, structure);
    this.derivedStructureLast = structure;
    if (this.host.fullRebuildRequiredIs()) return;
    if (regrouped) return this.host.markDirty();
    const removed = [...previous.keys()].filter((id) => !this.derivedBrushesLast.has(id));
    if (removed.length > 0) this.derivedBrushesInvalidate(removed);
    const changed = derived.filter((brush) => previous.get(brush.id) !== brush).map((brush) => brush.id);
    if (changed.length > 0) this.host.markBrushesDirty(changed);
  }

  /**
   * Drops vanished derived brushes from the compiler and dirties the brushes
   * they touched, or forces a full compile when one was never compiled.
   *
   * @param brushIds Vanished derived brush ids.
   */
  private derivedBrushesInvalidate(brushIds: readonly string[]): void {
    const order = new Set(this.host.getLastBrushOrder());
    const gone = new Set(brushIds);
    const peers = brushIds.flatMap((id) => this.host.getCachedTouchPeerIds(id)).filter((id) => !gone.has(id));
    for (const id of brushIds) this.host.invalidateBrush(id);
    if (brushIds.every((id) => order.has(id))) this.host.markBrushesDirty(peers);
    else this.host.markDirty();
  }

  /**
   * Marks brushes dirty when a chamfer appeared or disappeared.
   *
   * @param brushIds Brush ids that need a prepared-geometry refresh.
   */
  private bevelDirtyMark(brushIds: readonly string[]): void {
    if (brushIds.length === 0 || this.host.fullRebuildRequiredIs()) return;
    this.host.markBrushesDirty(brushIds);
  }
}
