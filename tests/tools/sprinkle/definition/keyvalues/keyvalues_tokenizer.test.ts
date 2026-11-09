import { describe, expect, it } from 'vitest';
import { KeyValuesParseError } from '@/tools/sprinkle/definition/keyvalues/keyvalues_parse_error.js';
import { KeyValuesTokenizer } from '@/tools/sprinkle/definition/keyvalues/keyvalues_tokenizer.js';

/** Path named in the errors of these tests. */
const TOKENIZER_TEST_SOURCE_PATH = 'sprinkle/test_types.txt';

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

/** Unit tests for splitting Valve KeyValues text into tokens. */
describe('KeyValuesTokenizer', () => {
  it('reads quoted and bare texts and braces with the line each starts on', () => {
    const lines = ['"Agave Plants"', '{', '\tbase { classname prop }', '}'];
    const tokens = KeyValuesTokenizer.tokenize(lines.join('\r\n'), TOKENIZER_TEST_SOURCE_PATH);
    expect(tokens.map((token) => [token.kind, token.text])).toEqual([
      ['text', 'Agave Plants'],
      ['block_open', '{'],
      ['text', 'base'],
      ['block_open', '{'],
      ['text', 'classname'],
      ['text', 'prop'],
      ['block_close', '}'],
      ['block_close', '}'],
    ]);
    expect(tokens[0]?.line).toBe(lineOf(lines, 'Agave'));
    expect(tokens.find((token) => token.text === 'classname')?.line).toBe(lineOf(lines, 'classname'));
    expect(tokens[tokens.length - 1]?.line).toBe(lines.length);
  });

  it('skips line comments, also right after a bare token, but not inside quotes', () => {
    const lines = ['// a comment line', 'grid "64 64" // trailing', 'weight//glued', '"url" "http://x"'];
    const texts = KeyValuesTokenizer.tokenize(lines.join('\n'), TOKENIZER_TEST_SOURCE_PATH).map((token) => token.text);
    expect(texts).toEqual(['grid', '64 64', 'weight', 'url', 'http://x']);
  });

  it('unescapes quotes and backslashes and keeps other backslashes and line breaks', () => {
    const text = '"say \\"hi\\"" "a\\\\b" "models\\props\\new.glb" "two\nlines" after';
    const tokens = KeyValuesTokenizer.tokenize(text, TOKENIZER_TEST_SOURCE_PATH);
    expect(tokens.map((token) => token.text)).toEqual([
      'say "hi"',
      'a\\b',
      'models\\props\\new.glb',
      'two\nlines',
      'after',
    ]);
    expect(tokens[tokens.length - 1]?.line).toBe(2);
  });

  it('names the file and the opening line of quoted text that is never closed', () => {
    const lines = ['key "value"', 'open "never closed', 'more'];
    const tokenize = () => KeyValuesTokenizer.tokenize(lines.join('\n'), TOKENIZER_TEST_SOURCE_PATH);
    expect(tokenize).toThrow(KeyValuesParseError);
    expect(tokenize).toThrow(`${TOKENIZER_TEST_SOURCE_PATH}:${lineOf(lines, 'never closed')}:`);
  });

  it('returns no tokens for empty or comment-only text', () => {
    expect(KeyValuesTokenizer.tokenize('', TOKENIZER_TEST_SOURCE_PATH)).toEqual([]);
    expect(KeyValuesTokenizer.tokenize('  // only\n\t// comments', TOKENIZER_TEST_SOURCE_PATH)).toEqual([]);
  });
});
