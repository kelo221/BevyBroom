import type {
  KeyValuesNode,
  KeyValuesNodeBlock,
  KeyValuesNodeText,
} from '@/tools/sprinkle/definition/keyvalues/keyvalues_node.js';
import type { SprinkleDefinitionGrid } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import type { SprinkleDefinitionComponentReader } from './sprinkle_definition_component_reader.js';
import type { SprinkleDefinitionFileProblems } from './sprinkle_definition_file_problems.js';
import {
  sprinkleDefinitionComponentsMerge,
  sprinkleDefinitionSectionEmpty,
  type SprinkleDefinitionSection,
  type SprinkleDefinitionSectionRole,
} from './sprinkle_definition_section.js';

/** Key naming the entity class of a section, compared without case. */
const SPRINKLE_DEFINITION_KEY_CLASS_NAME = 'classname';

/** Key naming the grid of a type in its base, compared without case. */
const SPRINKLE_DEFINITION_KEY_GRID = 'grid';

/**
 * Reads the base block or a case block of a sprinkle type: its classname, its
 * grid (base only) and its component blocks. Other keys are reported and
 * ignored.
 */
export class SprinkleDefinitionSectionReader {
  private readonly componentReader: SprinkleDefinitionComponentReader;

  /**
   * Creates the reader.
   *
   * @param componentReader Reads the component blocks of a section.
   */
  constructor(componentReader: SprinkleDefinitionComponentReader) {
    this.componentReader = componentReader;
  }

  /**
   * Reads one section.
   *
   * @param children Entries of the block.
   * @param role Whether the block is the base or a case.
   * @param problems Collects ignored keys and malformed values.
   * @returns Values of the section.
   */
  read(
    children: readonly KeyValuesNode[],
    role: SprinkleDefinitionSectionRole,
    problems: SprinkleDefinitionFileProblems,
  ): SprinkleDefinitionSection {
    const section = sprinkleDefinitionSectionEmpty();
    children.forEach((child) => this.childRead(child, role, section, problems));
    return section;
  }

  /**
   * Reads one entry of a section.
   *
   * @param child Entry as written.
   * @param role Whether the block is the base or a case.
   * @param section Section being read, updated in place.
   * @param problems Collects ignored keys and malformed values.
   */
  private childRead(
    child: KeyValuesNode,
    role: SprinkleDefinitionSectionRole,
    section: SprinkleDefinitionSection,
    problems: SprinkleDefinitionFileProblems,
  ): void {
    if (child.kind === 'block') {
      this.componentBlockRead(child, section, problems);
      return;
    }
    const key = child.key.toLowerCase();
    if (key === SPRINKLE_DEFINITION_KEY_CLASS_NAME) {
      SprinkleDefinitionSectionReader.classNameRead(child, section, problems);
    } else if (key === SPRINKLE_DEFINITION_KEY_GRID) {
      SprinkleDefinitionSectionReader.gridEntryRead(child, role, section, problems);
    } else {
      problems.report(child.line, `unknown key "${child.key}" ignored`);
    }
  }

  /**
   * Reads a component block, merging it over a block of the same type path
   * written earlier in the section.
   *
   * @param child Block keyed by the component type path.
   * @param section Section being read, updated in place.
   * @param problems Collects values that do not fit their field.
   */
  private componentBlockRead(
    child: KeyValuesNodeBlock,
    section: SprinkleDefinitionSection,
    problems: SprinkleDefinitionFileProblems,
  ): void {
    const fields = this.componentReader.read(child, problems);
    section.components = sprinkleDefinitionComponentsMerge(section.components, { [child.key]: fields });
  }

  /**
   * Reads the classname entry.
   *
   * @param child Entry as written.
   * @param section Section being read, updated in place.
   * @param problems Collects an empty classname.
   */
  private static classNameRead(
    child: KeyValuesNodeText,
    section: SprinkleDefinitionSection,
    problems: SprinkleDefinitionFileProblems,
  ): void {
    const className = child.value.trim();
    if (className === '') {
      problems.report(child.line, 'classname is empty; ignored');
      return;
    }
    section.className = className;
  }

  /**
   * Reads the grid entry, which only the base may hold.
   *
   * @param child Entry as written.
   * @param role Whether the block is the base or a case.
   * @param section Section being read, updated in place.
   * @param problems Collects a misplaced or malformed grid.
   */
  private static gridEntryRead(
    child: KeyValuesNodeText,
    role: SprinkleDefinitionSectionRole,
    section: SprinkleDefinitionSection,
    problems: SprinkleDefinitionFileProblems,
  ): void {
    if (role !== 'base') {
      problems.report(child.line, 'grid is only read from base; ignored');
      return;
    }
    section.grid = SprinkleDefinitionSectionReader.gridParse(child, problems);
  }

  /**
   * Parses a grid written as two cell sizes in meters, such as "2 2".
   *
   * @param child Entry as written.
   * @param problems Collects a malformed grid.
   * @returns The grid, or null when the text is not two sizes above zero.
   */
  private static gridParse(
    child: KeyValuesNodeText,
    problems: SprinkleDefinitionFileProblems,
  ): SprinkleDefinitionGrid | null {
    const sizes = child.value.trim().split(/\s+/).map(Number);
    const [sizeU, sizeV] = sizes;
    const isValid = sizes.length === 2 && sizes.every((size) => Number.isFinite(size) && size > 0);
    if (!isValid || sizeU === undefined || sizeV === undefined) {
      problems.report(child.line, `grid "${child.value}" must be two cell sizes above zero in meters; ignored`);
      return null;
    }
    return { sizeU, sizeV };
  }
}
