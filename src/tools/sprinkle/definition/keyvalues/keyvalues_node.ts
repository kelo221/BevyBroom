/** Parts every KeyValues node has. */
export interface KeyValuesNodeBase {
  /** Key of the node as written, without quotes. */
  readonly key: string;
  /** One-based line the key is written on. */
  readonly line: number;
}

/** A key with a text value. */
export interface KeyValuesNodeText extends KeyValuesNodeBase {
  readonly kind: 'text';
  /** Value as written, without quotes. */
  readonly value: string;
}

/** A key with a block of child nodes. */
export interface KeyValuesNodeBlock extends KeyValuesNodeBase {
  readonly kind: 'block';
  /** Child nodes in file order. */
  readonly children: readonly KeyValuesNode[];
}

/** One key of a KeyValues text and its value. */
export type KeyValuesNode = KeyValuesNodeText | KeyValuesNodeBlock;
