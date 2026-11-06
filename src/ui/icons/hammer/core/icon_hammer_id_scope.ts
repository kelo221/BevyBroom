/**
 * Hands out element ids for one rendered icon, unique across every icon
 * rendered on the page so gradients and clip paths never clash.
 */
export class IconHammerIdScope {
  private static renderCounter = 0;
  private readonly prefix: string;

  /**
   * Opens a new id scope for one icon render.
   *
   * @param iconName Name of the icon being rendered, kept in the ids for
   *   readability.
   */
  constructor(iconName: string) {
    IconHammerIdScope.renderCounter += 1;
    this.prefix = `icon-hammer-${iconName}-${IconHammerIdScope.renderCounter}`;
  }

  /**
   * Returns the page-unique id for a local element name.
   *
   * @param localName Name unique within this icon.
   * @returns Element id.
   */
  idFor(localName: string): string {
    return `${this.prefix}-${localName}`;
  }

  /**
   * Returns a `url(#id)` reference to a local element.
   *
   * @param localName Name unique within this icon.
   * @returns Paint or clip reference.
   */
  urlFor(localName: string): string {
    return `url(#${this.idFor(localName)})`;
  }
}
