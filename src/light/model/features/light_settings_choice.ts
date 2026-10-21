/**
 * Returns a value when it is one of the allowed choices, otherwise the
 * fallback.
 *
 * @param value Candidate value.
 * @param choices Allowed choices.
 * @param fallback Choice used for any other value.
 * @returns An allowed choice.
 */
export function lightSettingsChoiceRead<TChoice extends string>(
  value: unknown,
  choices: readonly TChoice[],
  fallback: TChoice,
): TChoice {
  return choices.find((choice) => choice === value) ?? fallback;
}
