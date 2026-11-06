/**
 * One keyvalue as plain text, the way Hammer lists keyvalues with SmartEdit
 * off: a key, the value of every edited object and a commit of typed text.
 */
export interface ObjectPropertiesKeyvalueRawRow {
  /** Key the value is stored under, such as `targetname` or `radius`. */
  readonly key: string;
  /** Readable caption, such as `Name`. */
  readonly label: string;
  /** Description shown in the help box when the row is selected. */
  readonly helpText: string;
  /** Value of every edited object as text. */
  readonly valueTexts: readonly string[];
  /** Writes typed text as the value of every edited object. */
  readonly commit: (text: string) => void;
}

/**
 * Formats a stored value as raw keyvalue text: text as it is, anything else as
 * JSON.
 *
 * @param value Stored value.
 * @returns Value text.
 */
export function objectPropertiesKeyvalueTextFormat(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Reads raw keyvalue text back into a value of the same type as an example: the
 * text itself for text values, else JSON when it parses, else the text.
 *
 * @param text Typed text.
 * @param example Current value of the keyvalue, which gives its type.
 * @returns Parsed value.
 */
export function objectPropertiesKeyvalueTextParse(text: string, example: unknown): unknown {
  if (typeof example === 'string') {
    return text;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
