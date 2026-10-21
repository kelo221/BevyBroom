/**
 * Ordered list of plug-in items made of the items the editor ships with and the
 * items features register while the editor runs. Built-in items are read lazily
 * so the registry can be imported before the modules that define them finished
 * loading.
 */
export class RegistryExtensible<TItem> {
  private readonly builtinItemsResolve: () => readonly TItem[];
  private builtinItems: readonly TItem[] | null = null;
  private readonly runtimeItems: TItem[] = [];
  private cachedItems: readonly TItem[] | null = null;

  /**
   * Creates a registry.
   *
   * @param builtinItemsResolve Returns the items the editor ships with; called
   *   once on first use.
   */
  constructor(builtinItemsResolve: () => readonly TItem[]) {
    this.builtinItemsResolve = builtinItemsResolve;
  }

  /**
   * Adds an item after every built-in and earlier registered item. Adding an
   * item that is already listed does nothing.
   *
   * @param item Item to add.
   */
  register(item: TItem): void {
    if (this.list().includes(item)) {
      return;
    }
    this.runtimeItems.push(item);
    this.cachedItems = null;
  }

  /**
   * Removes an item registered at runtime. Built-in items stay.
   *
   * @param item Item to remove.
   */
  unregister(item: TItem): void {
    const index = this.runtimeItems.indexOf(item);
    if (index < 0) {
      return;
    }
    this.runtimeItems.splice(index, 1);
    this.cachedItems = null;
  }

  /**
   * Returns every item: built-in items first, then registered items in
   * registration order.
   *
   * @returns Shared read-only list; do not keep it across registrations.
   */
  list(): readonly TItem[] {
    if (this.cachedItems === null) {
      this.builtinItems ??= this.builtinItemsResolve();
      this.cachedItems = [...this.builtinItems, ...this.runtimeItems];
    }
    return this.cachedItems;
  }
}
