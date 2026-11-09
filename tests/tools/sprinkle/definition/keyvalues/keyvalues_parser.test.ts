import { describe, expect, it } from 'vitest';
import type { KeyValuesNode } from '@/tools/sprinkle/definition/keyvalues/keyvalues_node.js';
import { KeyValuesParseError } from '@/tools/sprinkle/definition/keyvalues/keyvalues_parse_error.js';
import { KeyValuesParser } from '@/tools/sprinkle/definition/keyvalues/keyvalues_parser.js';

/** Path named in the errors of these tests. */
const PARSER_TEST_SOURCE_PATH = 'sprinkle/parser_types.txt';

/**
 * Returns the one-based line of the first line that contains a marker.
 *
 * @param lines Lines of a text.
 * @param marker Text to look for.
 * @returns Line number.
 */
function lineOf(lines: readonly string[], marker: string): number {
  return lines.findIndex((line) => line.includes(marker)) + 1;
}

/**
 * Parses lines and returns the error it throws.
 *
 * @param lines Lines of a text expected to be malformed.
 * @returns The parse error.
 */
function parseErrorRead(lines: readonly string[]): KeyValuesParseError {
  try {
    KeyValuesParser.parse(lines.join('\n'), PARSER_TEST_SOURCE_PATH);
  } catch (error) {
    if (error instanceof KeyValuesParseError) {
      return error;
    }
    throw error;
  }
  throw new Error('the text parsed without an error');
}

/**
 * Returns the children of a block node.
 *
 * @param node Node expected to be a block.
 * @returns Its children.
 */
function childrenOf(node: KeyValuesNode | undefined): readonly KeyValuesNode[] {
  if (node?.kind !== 'block') {
    throw new Error('expected a block');
  }
  return node.children;
}

/** Unit tests for reading Valve KeyValues text into a tree. */
describe('KeyValuesParser', () => {
  it('reads several top-level blocks with nested blocks, text values and key lines', () => {
    const lines = ['"First" // type', '{', '\tbase', '\t{', '\t\t"classname" "prop"', '\t}', '}', 'Second { 10 { } }'];
    const nodes = KeyValuesParser.parse(lines.join('\n'), PARSER_TEST_SOURCE_PATH);
    expect(nodes.map((node) => node.key)).toEqual(['First', 'Second']);
    expect(nodes[0]?.line).toBe(lineOf(lines, 'First'));
    const base = childrenOf(nodes[0])[0];
    expect(base?.key).toBe('base');
    expect(base?.line).toBe(lineOf(lines, 'base'));
    expect(childrenOf(base)).toEqual([
      { kind: 'text', key: 'classname', line: lineOf(lines, 'classname'), value: 'prop' },
    ]);
    expect(childrenOf(childrenOf(nodes[1])[0])).toEqual([]);
  });

  it('keeps duplicate keys in file order', () => {
    const nodes = KeyValuesParser.parse('a 1 a 2 b { a 3 }', PARSER_TEST_SOURCE_PATH);
    expect(nodes.map((node) => (node.kind === 'text' ? node.value : 'block'))).toEqual(['1', '2', 'block']);
  });

  it('names the line of a block that is never closed', () => {
    const lines = ['Fine { a b }', 'Broken', '{', '\tinner { x y }'];
    const error = parseErrorRead(lines);
    expect(error.line).toBe(lineOf(lines, 'Broken'));
    expect(error.message).toBe(`${PARSER_TEST_SOURCE_PATH}:${error.line}: ${error.reason}`);
    expect(error.reason).toContain('Broken');
  });

  it('names the line of a closing brace without a block', () => {
    const lines = ['Fine { a b }', '}'];
    expect(parseErrorRead(lines).line).toBe(lines.length);
  });

  it('names the line of a key without a value, at the end or before a closing brace', () => {
    const atEnd = ['a b', 'lonely'];
    expect(parseErrorRead(atEnd).line).toBe(lineOf(atEnd, 'lonely'));
    expect(parseErrorRead(atEnd).reason).toContain('lonely');
    const beforeBrace = ['Type', '{', '\tdangling', '}'];
    expect(parseErrorRead(beforeBrace).line).toBe(lineOf(beforeBrace, 'dangling'));
  });

  it('names the line of a block that has no key', () => {
    const lines = ['a b', '{ c d }'];
    expect(parseErrorRead(lines).line).toBe(lineOf(lines, '{'));
  });
});
