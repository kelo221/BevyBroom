/** Kind of one KeyValues token: a quoted or bare text, or a block brace. */
export type KeyValuesTokenKind = 'text' | 'block_open' | 'block_close';

/** One token of a KeyValues text. */
export interface KeyValuesToken {
  /** What the token is. */
  readonly kind: KeyValuesTokenKind;
  /** Text of the token without quotes; the brace itself for braces. */
  readonly text: string;
  /** One-based line the token starts on. */
  readonly line: number;
}
