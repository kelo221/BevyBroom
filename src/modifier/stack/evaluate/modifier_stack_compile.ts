import { modifierSmoothPublish } from '@/modifier/smooth/modifier_smooth_shading.js';
import type * as THREE from 'three';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { ModifierBevelSurfaceOverlay } from '@/modifier/compile/modifier_bevel_surface_overlay.js';
import { ModifierVolume, modifierVolumeSceneRoot, modifierVolumesActive } from '@/modifier/stack/modifier_volume.js';
import type { ModifierStackUnit, ModifierStackUnitSlot } from '@/modifier/stack/modifier_stack_types.js';
import { modifierStackCaptureInvalidCount, modifierStackCaptureUnits } from './modifier_stack_capture.js';
import { modifierStackCapsResolve } from './modifier_stack_caps.js';
import { modifierStackTargetsResolve } from '@/modifier/stack/scope/modifier_stack_targets.js';
import { modifierStackAuthoredBevel, type ModifierStackCapture } from './modifier_stack_authored_bevel.js';
import { ModifierStackBudget } from './modifier_stack_budget.js';
import { ModifierStackRecords } from './modifier_stack_records.js';
import { modifierStackStagingCreate } from './modifier_stack_frame.js';
import {
  modifierStackCacheOf,
  modifierStackCachePrune,
  modifierStackCacheBudgetFits,
  modifierStackCacheSignature,
  type ModifierStackCacheEntry,
} from './modifier_stack_cache.js';
import {
  modifierStackBrushCount,
  modifierStackEvaluateVolume,
  type ModifierStackSharedContext,
} from './modifier_stack_evaluate.js';
import type { ModifierBevelDerivedBrush } from '@/modifier/bevel/modifier_bevel_derived.js';
import { modifierStackStatusWrite } from './modifier_stack_status.js';
import { modifierStackTreeClone, modifierStackTreePlace, modifierStackVolumeSlot } from './modifier_stack_tree.js';
import {
  modifierStackHiddenStandIn,
  modifierStackReshapeChanged,
  modifierStackReshapedOf,
} from './modifier_stack_reshape.js';

/** Compile list and tree for one solid after every modifier volume ran. */
export interface ModifierStackCompileResult {
  /** Brushes handed to the CSG compiler. */
  instances: SolidBrushInstance[];
  /** Hierarchy the compiler walks: the authored root, or a compile-only clone. */
  root: THREE.Object3D;
  /** True when derived brushes were produced; forces a full compile. */
  derivedActive: boolean;
  /**
   * Volumes whose cached evaluation was reused because nothing they read
   * changed.
   */
  reusedVolumes: number;
  /** Authored ids whose prepared geometry must refresh. */
  extraDirtyBrushIds: string[];
}

/** Presentation brushes of derived ids, per solid root, for result UVs. */
export const modifierStackDerivedByRoot = new WeakMap<THREE.Object3D, ReadonlyMap<string, SolidBrushInstance>>();

const modifierStackDerivedIdsByScope = new Map<string, string[]>();

/**
 * Runs every active modifier volume against one solid's authored brushes. Every
 * volume captures from the same authored snapshot, so outputs never feed other
 * volumes and evaluation cannot loop.
 *
 * @param authored Authored evaluation list.
 * @param solidRoot Solid model root.
 * @returns Compile list, tree and dirty ids.
 */
export function modifierStackCompile(
  authored: readonly SolidBrushInstance[],
  solidRoot: THREE.Object3D,
): ModifierStackCompileResult {
  const scopeId = solidRoot.uuid;
  modifierStackDerivedOverlaysClear(scopeId);
  const sceneRoot = modifierVolumeSceneRoot(solidRoot);
  const captures = modifierVolumesActive(sceneRoot).map((volume) =>
    modifierStackCaptureOf(volume, authored, solidRoot),
  );
  const bevel = modifierStackAuthoredBevel(captures, scopeId);
  const shared = modifierStackSharedCreate(solidRoot, modifierStackRecordsSeed(authored, bevel.derived), (brush) =>
    modifierStackStandInOf(bevel.standIns, brush),
  );
  const runs = modifierStackRunAll(captures, shared);
  if (runs.length > 0) modifierStackDerivedPublish(scopeId, solidRoot, runs);
  return modifierStackCompileFinish({ authored, solidRoot, runs, bevel });
}

/**
 * Returns an authored bevel stand-in, or the brush itself.
 *
 * @param standIns Stand-ins by id.
 * @param brush Brush.
 * @returns Stand-in or brush.
 */
function modifierStackStandInOf(
  standIns: ReadonlyMap<string, SolidBrushInstance>,
  brush: SolidBrushInstance,
): SolidBrushInstance {
  return standIns.get(brush.id) ?? brush;
}

/** What a compile hands to its last step. */
interface ModifierStackCompileParts {
  authored: readonly SolidBrushInstance[];
  solidRoot: THREE.Object3D;
  runs: readonly ModifierStackRun[];
  bevel: { standIns: ReadonlyMap<string, SolidBrushInstance>; extraDirtyBrushIds: string[] };
}

/**
 * Swaps reshaped, hidden, and bevelled stand-ins into authored brushes, then
 * assembles the compile result.
 *
 * @param parts Compile parts.
 * @returns Compile result.
 */
function modifierStackCompileFinish(parts: ModifierStackCompileParts): ModifierStackCompileResult {
  const { bevel, solidRoot } = parts;
  const replaced = modifierStackReplacements(parts.authored, parts.runs);
  bevel.extraDirtyBrushIds.push(...modifierStackReshapeChanged(solidRoot.uuid, replaced));
  const swap = (brush: SolidBrushInstance) => replaced.get(brush.id) ?? modifierStackStandInOf(bevel.standIns, brush);
  const substituted = parts.authored.map(swap);
  const units = parts.runs.flatMap((run) => run.units);
  const result = modifierStackCompileResult(substituted, solidRoot, units, bevel.extraDirtyBrushIds);
  modifierSmoothPublish(solidRoot.uuid, result.instances);
  return { ...result, reusedVolumes: parts.runs.filter((run) => run.reused).length };
}

/**
 * Merges what the volumes did to authored brushes: reshaped stand-ins, and
 * hidden stand-ins for brushes a modifier removed. Later volumes win.
 *
 * @param authored Authored brushes.
 * @param runs Volume runs in order.
 * @returns Replacement per authored id.
 */
export function modifierStackReplacements(
  authored: readonly SolidBrushInstance[],
  runs: readonly Pick<ModifierStackRun, 'records' | 'reshaped'>[],
): Map<string, SolidBrushInstance> {
  const byId = new Map(authored.map((brush) => [brush.id, brush]));
  const replaced = new Map<string, SolidBrushInstance>();
  for (const run of runs) {
    for (const [id, standIn] of run.reshaped) replaced.set(id, standIn);
    for (const id of run.records.hiddenAll()) {
      const source = byId.get(id);
      if (source) replaced.set(id, modifierStackHiddenStandIn(source));
    }
  }
  return replaced;
}

/**
 * Captures one volume's authored operands: only brushes before it in its parent
 * whose built geometry meets its box.
 *
 * @param volume Modifier volume.
 * @param authored Authored brushes.
 * @param solidRoot Solid root.
 * @returns Capture.
 */
export function modifierStackCaptureOf(
  volume: THREE.Object3D,
  authored: readonly SolidBrushInstance[],
  solidRoot: THREE.Object3D,
): ModifierStackCapture {
  volume.updateWorldMatrix(true, false);
  const settings = ModifierVolume.read(volume);
  const targets = modifierStackTargetsResolve(volume, solidRoot, authored);
  const caps = modifierStackCapsResolve(settings, authored, solidRoot, volume);
  const capNodes = [...caps.values()].map((cap) => cap.tree);
  const units = modifierStackCaptureUnits(authored, solidRoot, volume, settings.grouping, capNodes, targets);
  return {
    caps,
    volume,
    settings,
    units,
    skipped: modifierStackCaptureInvalidCount(authored, volume, targets.scope),
    unbevelled: 0,
  };
}

/**
 * Creates presentation records seeded with the authored chamfers, so copies of
 * chamfered brushes inherit their strip shading.
 *
 * @param authored Authored brushes.
 * @param chamfers Chamfer per authored id.
 * @returns Records.
 */
export function modifierStackRecordsSeed(
  authored: readonly SolidBrushInstance[],
  chamfers: ReadonlyMap<string, ModifierBevelDerivedBrush>,
): ModifierStackRecords {
  const records = new ModifierStackRecords();
  for (const source of authored) {
    const derived = chamfers.get(source.id);
    if (derived) records.bevelSet(source.id, { derived, presentation: source });
  }
  return records;
}

/**
 * Creates the context shared by every modifier of this compile.
 *
 * @param solidRoot Solid root.
 * @param records Presentation records.
 * @param authoredBevel Stand-in lookup of authored brushes.
 * @returns Shared context.
 */
export function modifierStackSharedCreate(
  solidRoot: THREE.Object3D,
  records: ModifierStackRecords,
  authoredBevel: (brush: SolidBrushInstance) => SolidBrushInstance,
): ModifierStackSharedContext {
  return {
    solidRoot,
    staging: modifierStackStagingCreate(solidRoot),
    budget: new ModifierStackBudget(),
    caps: new Map(),
    authoredBevel,
    records,
  };
}

/**
 * Evaluates one volume's stack and records its status.
 *
 * @param capture Volume capture.
 * @param shared Shared context.
 * @returns Derived units, unanchored units carrying the volume's scene slot,
 *   with the records and reshaped authored brushes of the run.
 */
export function modifierStackRunCapture(
  capture: ModifierStackCapture,
  shared: ModifierStackSharedContext,
): Pick<ModifierStackRun, 'units' | 'records' | 'reshaped'> {
  const local = modifierStackLocalContext(capture, shared);
  return modifierStackRunLocal(capture, local, modifierStackVolumeSlot(capture.volume, shared.solidRoot));
}

/**
 * Runs every captured volume through the solid's evaluation cache and forgets
 * volumes that no longer run.
 *
 * @param captures Volume captures.
 * @param shared Shared context.
 * @returns Runs in capture order.
 */
function modifierStackRunAll(
  captures: readonly ModifierStackCapture[],
  shared: ModifierStackSharedContext,
): ModifierStackRun[] {
  const cache = modifierStackCacheOf(shared.solidRoot);
  const runs = captures.map((capture) => modifierStackRunCached(capture, shared, cache));
  modifierStackCachePrune(shared.solidRoot, new Set(captures.map((capture) => capture.volume.uuid)));
  return runs;
}

/** Outcome of one volume run, fresh or reused. */
export interface ModifierStackRun {
  /** Derived units. */
  units: ModifierStackUnit[];
  /** Presentation records of the derived brushes. */
  records: ModifierStackRecords;
  /** Stand-ins of authored brushes the run reshaped, by authored id. */
  reshaped: ReadonlyMap<string, SolidBrushInstance>;
  /** True when the cached evaluation was reused. */
  reused: boolean;
}

/**
 * Reuses a volume's cached evaluation when its signature still matches, else
 * evaluates it and caches the result by volume uuid.
 *
 * @param capture Volume capture.
 * @param shared Shared context.
 * @param cache Cache of this solid.
 * @returns Run outcome.
 */
function modifierStackRunCached(
  capture: ModifierStackCapture,
  shared: ModifierStackSharedContext,
  cache: Map<string, ModifierStackCacheEntry>,
): ModifierStackRun {
  const local = modifierStackLocalContext(capture, shared);
  const slot = modifierStackVolumeSlot(capture.volume, shared.solidRoot);
  const signature = modifierStackCacheSignature(capture, local, slot);
  const hit = cache.get(capture.volume.uuid);
  if (hit && hit.signature === signature && modifierStackCacheBudgetFits(hit, shared.budget.remaining())) {
    shared.budget.consume(hit.budgetUsed);
    modifierStackStatusWrite(capture.volume, shared.solidRoot.uuid, {
      ...hit.status,
      skipped: capture.skipped,
      unbevelled: capture.unbevelled,
    });
    return { units: hit.units, records: hit.records, reshaped: hit.reshaped, reused: true };
  }
  const entry = { signature, ...modifierStackRunLocal(capture, local, slot) };
  cache.set(capture.volume.uuid, entry);
  return { units: entry.units, records: entry.records, reshaped: entry.reshaped, reused: false };
}

/**
 * Builds the context one volume evaluates in, with its own records fork and the
 * caps it names.
 *
 * @param capture Volume capture.
 * @param shared Shared context.
 * @returns Volume context.
 */
function modifierStackLocalContext(
  capture: ModifierStackCapture,
  shared: ModifierStackSharedContext,
): ModifierStackSharedContext {
  return { ...shared, records: shared.records.fork(), caps: capture.caps };
}

/**
 * Evaluates one volume in its own context and writes its status.
 *
 * @param capture Volume capture.
 * @param local Volume context.
 * @param slot Scene slot for units without an authored origin.
 * @returns Cacheable evaluation without its signature.
 */
function modifierStackRunLocal(
  capture: ModifierStackCapture,
  local: ModifierStackSharedContext,
  slot: ModifierStackUnitSlot | undefined,
): Omit<ModifierStackCacheEntry, 'signature'> {
  const before = local.budget.remaining();
  const run = modifierStackEvaluateVolume(capture.volume, capture.settings, capture.units, local);
  const reshaped = modifierStackReshapedOf(run.units);
  const units = run.units
    .filter((unit) => !unit.authored)
    .map((unit) => (unit.origin === null && slot ? { ...unit, slot } : unit));
  for (const unit of units) for (const brush of unit.brushes) local.records.derivedAdd(brush);
  const status = {
    captured: modifierStackBrushCount(capture.units),
    derived: modifierStackBrushCount(units),
    skipped: capture.skipped,
    unbevelled: capture.unbevelled,
    steps: run.reports,
  };
  modifierStackStatusWrite(capture.volume, local.solidRoot.uuid, status);
  return { units, records: local.records, reshaped, status, ...modifierStackBudgetSpent(local.budget, before) };
}

/**
 * Describes what one evaluation took from the budget.
 *
 * @param budget Budget after the evaluation.
 * @param before Budget left when the evaluation started.
 * @returns Budget fields of a cache entry.
 */
function modifierStackBudgetSpent(
  budget: ModifierStackBudget,
  before: number,
): Pick<ModifierStackCacheEntry, 'budgetUsed' | 'budgetBefore' | 'budgetLimited'> {
  return { budgetUsed: before - budget.remaining(), budgetBefore: before, budgetLimited: budget.limited() };
}

/**
 * Publishes presentation brushes and shading overlays of derived brushes.
 *
 * @param scopeId Solid identity.
 * @param solidRoot Solid root.
 * @param runs Volume runs whose records are merged and published.
 */
function modifierStackDerivedPublish(
  scopeId: string,
  solidRoot: THREE.Object3D,
  runs: readonly ModifierStackRun[],
): void {
  const records = new ModifierStackRecords();
  for (const run of runs) records.absorb(run.records);
  const ids = [...records.derivedAll().keys()];
  for (const id of ids) {
    const bevel = records.bevelGet(id);
    if (bevel) ModifierBevelSurfaceOverlay.set(id, bevel.derived);
    const shading = records.normalsAll().get(id);
    if (shading) ModifierBevelSurfaceOverlay.shadingSet(id, shading);
  }
  modifierStackDerivedIdsByScope.set(scopeId, ids);
  modifierStackDerivedByRoot.set(solidRoot, records.derivedAll());
}

/**
 * Drops overlays of the derived ids the previous compile of a solid produced.
 *
 * @param scopeId Solid identity.
 */
function modifierStackDerivedOverlaysClear(scopeId: string): void {
  for (const id of modifierStackDerivedIdsByScope.get(scopeId) ?? []) {
    ModifierBevelSurfaceOverlay.clear(id);
    ModifierBevelSurfaceOverlay.shadingClear(id);
  }
  modifierStackDerivedIdsByScope.delete(scopeId);
}

/**
 * Assembles the compile result, building a compile-only tree when derived
 * brushes exist.
 *
 * @param substituted Authored list with chamfered stand-ins.
 * @param solidRoot Solid root.
 * @param units Derived units.
 * @param extraDirtyBrushIds Authored ids to refresh.
 * @returns Compile result.
 */
function modifierStackCompileResult(
  substituted: SolidBrushInstance[],
  solidRoot: THREE.Object3D,
  units: readonly ModifierStackUnit[],
  extraDirtyBrushIds: string[],
): ModifierStackCompileResult {
  if (units.length === 0) {
    modifierStackDerivedByRoot.delete(solidRoot);
    return { instances: substituted, root: solidRoot, derivedActive: false, extraDirtyBrushIds, reusedVolumes: 0 };
  }
  const virtualRoot = modifierStackTreeClone(solidRoot);
  modifierStackTreePlace(virtualRoot, units);
  const derived = units.flatMap((unit) => unit.brushes);
  return {
    instances: [...substituted, ...derived],
    root: virtualRoot,
    derivedActive: true,
    extraDirtyBrushIds,
    reusedVolumes: 0,
  };
}
