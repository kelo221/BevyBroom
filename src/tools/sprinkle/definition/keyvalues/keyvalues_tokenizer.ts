import { KeyValuesParseError } from './keyvalues_parse_error.js';
import type { KeyValuesToken } from './keyvalues_token.js';

/** Characters that end a bare token besides whitespace. */
const KEYVALUES_BARE_TOKEN_TERMINATORS = new Set(['{', '}', '"']);

/**
 * Characters a backslash escapes inside quoted text; other backslashes stay as
 * written.
 */
const KEYVALUES_ESCAPABLE_CHARACTERS = new Set(['"', '\\']);

/**
 * Splits a Valve KeyValues text into quoted or bare texts and block braces,
 * skipping whitespace and "//" line comments.
 */
export class KeyValuesTokenizer {
  private readonly text: string;
  private readonly sourcePath: string;
  private readonly tokens: KeyValuesToken[] = [];
  private position = 0;
  private line = 1;

  /**
   * Creates a tokenizer over one text.
   *
   * @param text KeyValues text.
   * @param sourcePath Path of the file named in errors.
   */
  private constructor(text: string, sourcePath: string) {
    this.text = text;
    this.sourcePath = sourcePath;
  }

  /**
   * Splits a text into tokens.
   *
   * @param text KeyValues text.
   * @param sourcePath Path of the file named in errors.
   * @returns Tokens in text order.
   * @throws KeyValuesParseError when quoted text is never closed.
   */
  static tokenize(text: string, sourcePath: string): KeyValuesToken[] {
    return new KeyValuesTokenizer(text, sourcePath).tokensRead();
  }

  /**
   * Reads every token of the text.
   *
   * @returns Tokens in text order.
   */
  private tokensRead(): KeyValuesToken[] {
    this.separatorsSkip();
    while (!this.isAtEnd()) {
      this.tokenRead();
      this.separatorsSkip();
    }
    return this.tokens;
  }

  /** Reads the token starting at the current position. */
  private tokenRead(): void {
    const character = this.characterCurrent();
    if (character === '{' || character === '}') {
      this.tokenPush(character === '{' ? 'block_open' : 'block_close', character, this.line);
      this.position += 1;
    } else if (character === '"') {
      this.quotedRead();
    } else {
      this.bareRead();
    }
  }

  /** Skips whitespace and comments, counting lines. */
  private separatorsSkip(): void {
    while (!this.isAtEnd()) {
      const character = this.characterCurrent();
      if (this.isCommentStart()) {
        this.commentSkip();
      } else if (/\s/.test(character)) {
        this.lineCountAdvance(character);
        this.position += 1;
      } else {
        return;
      }
    }
  }

  /** Skips a comment up to, but not including, the end of its line. */
  private commentSkip(): void {
    while (!this.isAtEnd() && this.characterCurrent() !== '\n') {
      this.position += 1;
    }
  }

  /**
   * Reads quoted text, keeping line breaks and unescaping " and .
   *
   * @throws KeyValuesParseError when the closing quote is missing.
   */
  private quotedRead(): void {
    const startLine = this.line;
    let value = '';
    this.position += 1;
    while (!this.isAtEnd() && this.characterCurrent() !== '"') {
      value += this.quotedCharacterRead();
    }
    if (this.isAtEnd()) {
      throw new KeyValuesParseError(this.sourcePath, startLine, 'quoted text is never closed');
    }
    this.position += 1;
    this.tokenPush('text', value, startLine);
  }

  /**
   * Reads one character of quoted text, resolving an escape sequence.
   *
   * @returns Characters the position stood for.
   */
  private quotedCharacterRead(): string {
    const character = this.characterCurrent();
    const following = this.text.charAt(this.position + 1);
    if (character === '\\' && KEYVALUES_ESCAPABLE_CHARACTERS.has(following)) {
      this.position += 2;
      return following;
    }
    this.lineCountAdvance(character);
    this.position += 1;
    return character;
  }

  /** Reads a bare token up to whitespace, a brace, a quote or a comment. */
  private bareRead(): void {
    const start = this.position;
    while (!this.isAtEnd() && !this.isBareTokenEnd()) {
      this.position += 1;
    }
    this.tokenPush('text', this.text.slice(start, this.position), this.line);
  }

  /**
   * Returns whether the current character ends a bare token.
   *
   * @returns True at whitespace, braces, quotes and comments.
   */
  private isBareTokenEnd(): boolean {
    const character = this.characterCurrent();
    return /\s/.test(character) || KEYVALUES_BARE_TOKEN_TERMINATORS.has(character) || this.isCommentStart();
  }

  /**
   * Returns whether a "//" comment starts at the current position.
   *
   * @returns True at a comment.
   */
  private isCommentStart(): boolean {
    return this.text.startsWith('//', this.position);
  }

  /**
   * Counts a line when a character is a line break.
   *
   * @param character Character being passed.
   */
  private lineCountAdvance(character: string): void {
    if (character === '\n') {
      this.line += 1;
    }
  }

  /**
   * Returns the character at the current position.
   *
   * @returns One character, or empty at the end.
   */
  private characterCurrent(): string {
    return this.text.charAt(this.position);
  }

  /**
   * Returns whether the whole text has been read.
   *
   * @returns True at the end.
   */
  private isAtEnd(): boolean {
    return this.position >= this.text.length;
  }

  /**
   * Adds a token.
   *
   * @param kind Kind of the token.
   * @param text Text of the token.
   * @param line Line the token starts on.
   */
  private tokenPush(kind: KeyValuesToken['kind'], text: string, line: number): void {
    this.tokens.push({ kind, text, line });
  }
}
