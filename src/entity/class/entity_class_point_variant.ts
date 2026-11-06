/**
 * One point class an entity kind offers, such as the point and spot variants of
 * lights. The kind's definition lists its variants; the class registry turns
 * each into a selectable class.
 */
export interface EntityClassPointVariant<TSettings extends object> {
  /** Stable class id, such as `lights.point`. */
  readonly id: string;
  /** Visible class name, such as `Point Light`. */
  readonly label: string;
  /** Category the class is listed under, such as `Lights`. */
  readonly category: string;
  /** Text the Object Properties help box shows for the class. */
  readonly helpText: string;
  /**
   * Returns the settings of an owner of this class.
   *
   * @param previous Settings the owner had when it already was of the same
   *   kind, or null for a new owner or one of another kind.
   * @returns Settings, not yet validated.
   */
  settingsCreate(previous: TSettings | null): TSettings;
  /**
   * Returns whether an owner with these settings is of this class.
   *
   * @param settings Valid settings of an owner of the kind.
   * @returns True when the settings belong to this class.
   */
  settingsMatch(settings: TSettings): boolean;
}
