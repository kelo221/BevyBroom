import { describe, expect, it } from 'vitest';
import type { GameEntityClass, GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { SprinkleDefinitionBuilder } from '@/tools/sprinkle/definition/builder/sprinkle_definition_builder.js';
import type { SprinkleDefinitionFile } from '@/tools/sprinkle/definition/sprinkle_definition.js';

/** Component type path of the game class the tests know. */
const BUILDER_TEST_TREE_TYPE_PATH = 'test_game::Tree';

/** Component type path no class lookup knows. */
const BUILDER_TEST_UNKNOWN_TYPE_PATH = 'other_game::Mystery';

/** Upper bound of the clamped number field of the test class. */
const BUILDER_TEST_HEIGHT_MAXIMUM = 10;

/**
 * Creates one field of the test class.
 *
 * @param path Field path.
 * @param kind Field kind.
 * @param extra Optional parts such as bounds or variants.
 * @returns Field.
 */
function fieldCreate(
  path: string,
  kind: GameEntityField['kind'],
  extra: Partial<GameEntityField> = {},
): GameEntityField {
  return { path, label: path, kind, default: null, ...extra };
}

/**
 * Creates the game class the tests know, with one field of every converted
 * kind, one of them inside a group.
 *
 * @returns Game class.
 */
function treeClassCreate(): GameEntityClass {
  return {
    type_path: BUILDER_TEST_TREE_TYPE_PATH,
    label: 'Tree',
    category: 'Test',
    placement: 'any',
    marker_color: [0, 1, 0],
    fields: [
      fieldCreate('model', 'asset'),
      fieldCreate('height', 'number', { maximum: BUILDER_TEST_HEIGHT_MAXIMUM }),
      fieldCreate('branches', 'integer'),
      fieldCreate('evergreen', 'bool'),
      fieldCreate('sway', 'vector3'),
      fieldCreate('tint', 'color'),
      fieldCreate('season', 'enum', { variants: ['summer', 'winter'] }),
      fieldCreate('tags', 'property_map'),
      fieldCreate('looks', 'group', { children: [fieldCreate('name', 'text')] }),
    ],
  };
}

/**
 * Creates a builder that knows only the test class.
 *
 * @returns Builder.
 */
function builderCreate(): SprinkleDefinitionBuilder {
  const treeClass = treeClassCreate();
  return new SprinkleDefinitionBuilder((typePath) => (typePath === treeClass.type_path ? treeClass : null));
}

/**
 * Creates a definition file from lines.
 *
 * @param path File path.
 * @param lines Lines of the file.
 * @returns Definition file.
 */
function fileCreate(path: string, lines: readonly string[]): SprinkleDefinitionFile {
  return { path, text: lines.join('\n') };
}

/**
 * Returns every problem that names a line of a file.
 *
 * @param problems Problems of a build.
 * @param file File the problems are about.
 * @param marker Text of the line the problems are about.
 * @returns The problems in order.
 */
function problemsAt(problems: readonly string[], file: SprinkleDefinitionFile, marker: string): string[] {
  const line = file.text.split('\n').findIndex((text) => text.includes(marker)) + 1;
  return problems.filter((problem) => problem.startsWith(`${file.path}:${line}: `));
}

/**
 * Returns the first problem that names a line of a file.
 *
 * @param problems Problems of a build.
 * @param file File the problem is about.
 * @param marker Text of the line the problem is about.
 * @returns The problem, or undefined when there is none.
 */
function problemAt(problems: readonly string[], file: SprinkleDefinitionFile, marker: string): string | undefined {
  return problemsAt(problems, file, marker)[0];
}

/** Unit tests for turning sprinkle definition files into sprinkle types. */
describe('SprinkleDefinitionBuilder', () => {
  it('merges the base into every weighted case and lets a case override the classname', () => {
    const file = fileCreate('sprinkle/plants.txt', [
      '"Agave Plants" // shown in the Type list',
      '{',
      '  base { "classname" "game.tree" grid "2 3" }',
      '  10 { }',
      '  5.5 { classname "lights.point" }',
      '}',
    ]);
    const result = builderCreate().filesBuild([file]);
    expect(result.problems).toEqual([]);
    expect(result.definitions).toHaveLength(1);
    const definition = result.definitions[0];
    expect(definition?.name).toBe('Agave Plants');
    expect(definition?.sourcePath).toBe(file.path);
    expect(definition?.grid).toEqual({ sizeU: 2, sizeV: 3 });
    expect(definition?.cases.map((entry) => [entry.weight, entry.className])).toEqual([
      [10, 'game.tree'],
      [5.5, 'lights.point'],
    ]);
  });

  it('merges component fields of a case over those of the base, per component', () => {
    const file = fileCreate('sprinkle/trees.txt', [
      'Trees {',
      `  base { classname game.tree "${BUILDER_TEST_TREE_TYPE_PATH}" { model "trees/pine.glb" height 3 } }`,
      `  1 { "${BUILDER_TEST_TREE_TYPE_PATH}" { height 4 } "${BUILDER_TEST_UNKNOWN_TYPE_PATH}" { } }`,
      '  1 { }',
      '}',
    ]);
    const [overriding, plain] = builderCreate().filesBuild([file]).definitions[0]?.cases ?? [];
    expect(overriding?.components).toEqual({
      [BUILDER_TEST_TREE_TYPE_PATH]: { model: 'trees/pine.glb', height: 4 },
      [BUILDER_TEST_UNKNOWN_TYPE_PATH]: {},
    });
    expect(plain?.components).toEqual({ [BUILDER_TEST_TREE_TYPE_PATH]: { model: 'trees/pine.glb', height: 3 } });
  });

  it('converts values to the kinds of known fields and keeps unknown classes and fields as text', () => {
    const file = fileCreate('sprinkle/kinds.txt', [
      'Kinds { 1 { classname game.tree',
      `  "${BUILDER_TEST_TREE_TYPE_PATH}" {`,
      `    height ${BUILDER_TEST_HEIGHT_MAXIMUM * 2}`,
      '    branches 6.6',
      '    evergreen yes',
      '    sway "0.5 0 -1"',
      '    tint "0.1 0.2 0.3"',
      '    season winter',
      '    name "Old oak"',
      '    tags { leaf green }',
      '    unknown_field 12',
      '  }',
      `  "${BUILDER_TEST_UNKNOWN_TYPE_PATH}" { count 3 nested { a b } }`,
      '} }',
    ]);
    const result = builderCreate().filesBuild([file]);
    expect(result.problems).toEqual([]);
    expect(result.definitions[0]?.cases[0]?.components).toEqual({
      [BUILDER_TEST_TREE_TYPE_PATH]: {
        height: BUILDER_TEST_HEIGHT_MAXIMUM,
        branches: 7,
        evergreen: true,
        sway: [0.5, 0, -1],
        tint: [0.1, 0.2, 0.3, 1],
        season: 'winter',
        name: 'Old oak',
        tags: { leaf: 'green' },
        unknown_field: '12',
      },
      [BUILDER_TEST_UNKNOWN_TYPE_PATH]: { count: '3', nested: { a: 'b' } },
    });
  });

  it('reports values that do not fit their field and leaves those fields out', () => {
    const file = fileCreate('sprinkle/misfits.txt', [
      'Misfits { 1 { classname game.tree',
      `  "${BUILDER_TEST_TREE_TYPE_PATH}" {`,
      '    height tall',
      '    evergreen maybe',
      '    sway "1 2"',
      '    season autumn',
      '    model fine.glb',
      '  }',
      '} }',
    ]);
    const result = builderCreate().filesBuild([file]);
    expect(result.definitions[0]?.cases[0]?.components).toEqual({
      [BUILDER_TEST_TREE_TYPE_PATH]: { model: 'fine.glb' },
    });
    for (const marker of ['height tall', 'evergreen maybe', 'sway', 'season autumn']) {
      expect(problemAt(result.problems, file, marker)).toContain(BUILDER_TEST_TREE_TYPE_PATH);
    }
    expect(result.problems).toHaveLength(4);
  });

  it('reports unknown flat keys and a grid outside base without failing the type', () => {
    const file = fileCreate('sprinkle/valve.txt', [
      'Valve {',
      '  base { classname prop_static "uniformscale" 1 }',
      '  10 { "rendercolor" "13 204 75" grid "1 1" }',
      '  mystery_key value',
      '}',
    ]);
    const result = builderCreate().filesBuild([file]);
    expect(result.definitions.map((definition) => definition.name)).toEqual(['Valve']);
    expect(result.definitions[0]?.grid).toBeNull();
    expect(problemAt(result.problems, file, 'uniformscale')).toContain('uniformscale');
    const caseProblems = problemsAt(result.problems, file, 'rendercolor');
    expect(caseProblems.some((problem) => problem.includes('"rendercolor"'))).toBe(true);
    expect(caseProblems.some((problem) => problem.includes('grid'))).toBe(true);
    expect(result.problems).toHaveLength(4);
    expect(problemAt(result.problems, file, 'mystery_key')).toContain('mystery_key');
  });

  it('reports a malformed grid and keeps the type without one', () => {
    for (const grid of ['64', '0 2', '1 -1', 'a b', '1 2 3']) {
      const file = fileCreate('sprinkle/grid.txt', ['Grid {', `  base { classname a grid "${grid}" }`, '  1 { }', '}']);
      const result = builderCreate().filesBuild([file]);
      expect(result.definitions[0]?.grid).toBeNull();
      expect(problemAt(result.problems, file, 'grid "')).toContain(grid);
    }
  });

  it('skips cases without a positive weight or classname and types without a usable case', () => {
    const file = fileCreate('sprinkle/broken.txt', [
      'NoCases { base { classname a } }',
      'ZeroWeight { base { classname a } 0 { } -2 { } }',
      'NoClass {',
      '  1 { }',
      '  2 { classname kept }',
      '}',
      'NotABlock "text"',
      'TextCase { base { classname a } 3 "text" }',
    ]);
    const result = builderCreate().filesBuild([file]);
    expect(result.definitions.map((definition) => definition.name)).toEqual(['NoClass']);
    expect(result.definitions[0]?.cases.map((entry) => entry.className)).toEqual(['kept']);
    expect(problemAt(result.problems, file, 'NoCases')).toContain('NoCases');
    expect(problemAt(result.problems, file, 'ZeroWeight')).toBeDefined();
    expect(problemAt(result.problems, file, '1 { }')).toContain('classname');
    expect(problemAt(result.problems, file, 'NotABlock')).toContain('NotABlock');
    expect(problemAt(result.problems, file, 'TextCase')).toBeDefined();
  });

  it('keeps the first type of a name across files and reports the later one', () => {
    const first = fileCreate('sprinkle/a.txt', ['Shared { 1 { classname first } }']);
    const second = fileCreate('sprinkle/b.txt', [
      'Other { 1 { classname other } }',
      'Shared { 1 { classname second } }',
    ]);
    const result = builderCreate().filesBuild([first, second]);
    expect(result.definitions.map((definition) => [definition.name, definition.cases[0]?.className])).toEqual([
      ['Shared', 'first'],
      ['Other', 'other'],
    ]);
    expect(problemAt(result.problems, second, 'Shared')).toContain('Shared');
  });

  it('reports a file that cannot be parsed and still builds the other files', () => {
    const broken = fileCreate('sprinkle/broken.txt', ['Broken {', '  1 { classname a }']);
    const fine = fileCreate('sprinkle/fine.txt', ['Fine { 1 { classname a } }']);
    const result = builderCreate().filesBuild([broken, fine]);
    expect(result.definitions.map((definition) => definition.name)).toEqual(['Fine']);
    expect(problemAt(result.problems, broken, 'Broken')).toContain('never closed');
  });

  it('reports a second base and a base that is not a block, keeping the first block', () => {
    const file = fileCreate('sprinkle/bases.txt', [
      'Bases {',
      '  BASE { classname first }',
      '  base { classname second }',
      '  base text',
      '  1 { }',
      '}',
    ]);
    const result = builderCreate().filesBuild([file]);
    expect(result.definitions[0]?.cases[0]?.className).toBe('first');
    expect(problemAt(result.problems, file, 'classname second')).toBeDefined();
    expect(problemAt(result.problems, file, 'base text')).toBeDefined();
  });
});
