import type { KeyValuesNode, KeyValuesNodeBlock } from './keyvalues_node.js';
import { KeyValuesParseError } from './keyvalues_parse_error.js';
import type { KeyValuesToken } from './keyvalues_token.js';
import { KeyValuesTokenizer } from './keyvalues_tokenizer.js';

/**
 * Reads a Valve KeyValues text into a tree of keys with text or block values,
 * remembering the line of every key.
 */
export class KeyValuesParser {
  private readonly tokens: readonly KeyValuesToken[];
  private readonly sourcePath: string;
  private index = 0;

  /**
   * Creates a parser over the tokens of one text.
   *
   * @param tokens Tokens in text order.
   * @param sourcePath Path of the file named in errors.
   */
  private constructor(tokens: readonly KeyValuesToken[], sourcePath: string) {
    this.tokens = tokens;
    this.sourcePath = sourcePath;
  }

  /**
   * Parses a KeyValues text.
   *
   * @param text KeyValues text.
   * @param sourcePath Path of the file named in errors.
   * @returns Top-level nodes in file order.
   * @throws KeyValuesParseError naming the file and line of the first problem.
   */
  static parse(text: string, sourcePath: string): KeyValuesNode[] {
    return new KeyValuesParser(KeyValuesTokenizer.tokenize(text, sourcePath), sourcePath).documentRead();
  }

  /**
   * Reads the top-level nodes.
   *
   * @returns Nodes in file order.
   */
  private documentRead(): KeyValuesNode[] {
    const nodes: KeyValuesNode[] = [];
    let token = this.tokens[this.index];
    while (token !== undefined) {
      if (token.kind === 'block_close') {
        throw this.errorCreate(token.line, "'}' closes no block");
      }
      nodes.push(this.nodeRead(token));
      token = this.tokens[this.index];
    }
    return nodes;
  }

  /**
   * Reads one key and its value.
   *
   * @param keyToken Token at the current position, expected to be a key.
   * @returns The node.
   */
  private nodeRead(keyToken: KeyValuesToken): KeyValuesNode {
    if (keyToken.kind !== 'text') {
      throw this.errorCreate(keyToken.line, "expected a key but found '{'");
    }
    this.index += 1;
    const valueToken = this.tokens[this.index];
    if (valueToken === undefined || valueToken.kind === 'block_close') {
      throw this.errorCreate(keyToken.line, `key "${keyToken.text}" has no value`);
    }
    this.index += 1;
    if (valueToken.kind === 'text') {
      return { kind: 'text', key: keyToken.text, line: keyToken.line, value: valueToken.text };
    }
    return this.blockRead(keyToken);
  }

  /**
   * Reads the children of a block whose opening brace was just passed.
   *
   * @param keyToken Key of the block.
   * @returns The block node.
   */
  private blockRead(keyToken: KeyValuesToken): KeyValuesNodeBlock {
    const children: KeyValuesNode[] = [];
    let token = this.tokens[this.index];
    while (token !== undefined && token.kind !== 'block_close') {
      children.push(this.nodeRead(token));
      token = this.tokens[this.index];
    }
    if (token === undefined) {
      throw this.errorCreate(keyToken.line, `block "${keyToken.text}" is never closed`);
    }
    this.index += 1;
    return { kind: 'block', key: keyToken.text, line: keyToken.line, children };
  }

  /**
   * Creates an error about one line of the file.
   *
   * @param line One-based line.
   * @param reason What is wrong.
   * @returns The error.
   */
  private errorCreate(line: number, reason: string): KeyValuesParseError {
    return new KeyValuesParseError(this.sourcePath, line, reason);
  }
}
