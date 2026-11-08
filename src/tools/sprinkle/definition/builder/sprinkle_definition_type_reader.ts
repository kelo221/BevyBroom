import type { KeyValuesNode, KeyValuesNodeBlock } from '@/tools/sprinkle/definition/keyvalues/keyvalues_node.js';
import type { SprinkleDefinition, SprinkleDefinitionCase } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import type { SprinkleDefinitionFileProblems } from './sprinkle_definition_file_problems.js';
import { sprinkleDefinitionComponentsMerge, type SprinkleDefinitionSection } from './sprinkle_definition_section.js';
import type { SprinkleDefinitionSectionReader } from './sprinkle_definition_section_reader.js';

/**
 * Key of the block holding the values every case of a type shares, compared
 * without case.
 */
const SPRINKLE_DEFINITION_KEY_BASE = 'base';

/** The base block and the case entries of one type, sorted out of its children. */
interface SprinkleDefinitionTypeParts {
  /** Entries of the base block; empty without a base. */
  baseChildren: readonly KeyValuesNode[];
  /** Entries keyed by a weight, in file order. */
  caseNodes: KeyValuesNode[];
}

/**
 * Reads one top-level block of a sprinkle definition file into a type: its base
 * and its weighted cases with the base merged in. Broken cases are reported and
 * skipped; a type without a usable case is skipped.
 */
export class SprinkleDefinitionTypeReader {
  private readonly sectionReader: SprinkleDefinitionSectionReader;

  /**
   * Creates the reader.
   *
   * @param sectionReader Reads the base and case blocks.
   */
  constructor(sectionReader: SprinkleDefinitionSectionReader) {
    this.sectionReader = sectionReader;
  }

  /**
   * Reads one type.
   *
   * @param node Top-level entry keyed by the type name.
   * @param problems Collects everything that was ignored or skipped.
   * @returns The type, or null when it has no usable case.
   */
  read(node: KeyValuesNode, problems: SprinkleDefinitionFileProblems): SprinkleDefinition | null {
    if (node.kind !== 'block') {
      problems.report(node.line, `type "${node.key}" must be a block of base and weighted cases; skipped`);
      return null;
    }
    const parts = SprinkleDefinitionTypeReader.partsSort(node, problems);
    const base = this.sectionReader.read(parts.baseChildren, 'base', problems);
    const cases = parts.caseNodes
      .map((caseNode) => this.caseRead(caseNode, base, problems))
      .filter((definitionCase): definitionCase is SprinkleDefinitionCase => definitionCase !== null);
    if (cases.length === 0) {
      problems.report(node.line, `type "${node.key}" has no usable case; skipped`);
      return null;
    }
    return { name: node.key, sourcePath: problems.sourcePath, grid: base.grid, cases };
  }

  /**
   * Sorts the children of a type into its base and its cases.
   *
   * @param node Type block.
   * @param problems Collects children that are neither.
   * @returns The base entries and the case entries.
   */
  private static partsSort(
    node: KeyValuesNodeBlock,
    problems: SprinkleDefinitionFileProblems,
  ): SprinkleDefinitionTypeParts {
    const parts: SprinkleDefinitionTypeParts = { baseChildren: [], caseNodes: [] };
    let baseNode: KeyValuesNodeBlock | null = null;
    for (const child of node.children) {
      if (child.key.toLowerCase() === SPRINKLE_DEFINITION_KEY_BASE) {
        baseNode = SprinkleDefinitionTypeReader.baseChoose(baseNode, child, problems);
      } else if (SprinkleDefinitionTypeReader.isWeightKey(child.key)) {
        parts.caseNodes.push(child);
      } else {
        problems.report(child.line, `unknown key "${child.key}" in type "${node.key}" ignored`);
      }
    }
    parts.baseChildren = baseNode?.children ?? [];
    return parts;
  }

  /**
   * Picks the base block among the base entries seen so far.
   *
   * @param chosen Base chosen before, or null.
   * @param candidate Base entry just found.
   * @param problems Collects a base that is not a block or given twice.
   * @returns The base to keep.
   */
  private static baseChoose(
    chosen: KeyValuesNodeBlock | null,
    candidate: KeyValuesNode,
    problems: SprinkleDefinitionFileProblems,
  ): KeyValuesNodeBlock | null {
    if (candidate.kind !== 'block') {
      problems.report(candidate.line, 'base must be a block; ignored');
      return chosen;
    }
    if (chosen !== null) {
      problems.report(candidate.line, 'base is given twice; this one is ignored');
      return chosen;
    }
    return candidate;
  }

  /**
   * Reads one weighted case and merges the base into it.
   *
   * @param node Entry keyed by the weight.
   * @param base Values of the base.
   * @param problems Collects broken cases.
   * @returns The case, or null when it is skipped.
   */
  private caseRead(
    node: KeyValuesNode,
    base: SprinkleDefinitionSection,
    problems: SprinkleDefinitionFileProblems,
  ): SprinkleDefinitionCase | null {
    const weight = Number(node.key);
    if (node.kind !== 'block' || weight <= 0) {
      problems.report(node.line, `case "${node.key}" must be a block with a weight above zero; skipped`);
      return null;
    }
    const section = this.sectionReader.read(node.children, 'case', problems);
    const className = section.className ?? base.className;
    if (className === null) {
      problems.report(node.line, `case "${node.key}" has no classname and base names none; skipped`);
      return null;
    }
    return { weight, className, components: sprinkleDefinitionComponentsMerge(base.components, section.components) };
  }

  /**
   * Returns whether a key is a case weight.
   *
   * @param key Key as written.
   * @returns True for keys that are finite numbers.
   */
  private static isWeightKey(key: string): boolean {
    return key.trim() !== '' && Number.isFinite(Number(key));
  }
}
