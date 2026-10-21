/** Listener called after the layers or their members change. */
export type LayerChangeListener = () => void;

/** Keeps the change listeners of a layer manager and calls them in order. */
export class LayerChangeNotifier {
  private readonly listeners: Set<LayerChangeListener>;

  /** Creates a notifier without listeners. */
  constructor() {
    this.listeners = new Set();
  }

  /**
   * Adds a listener.
   *
   * @param listener Listener to add.
   */
  listenerAdd(listener: LayerChangeListener): void {
    this.listeners.add(listener);
  }

  /**
   * Removes a listener.
   *
   * @param listener Listener to remove.
   */
  listenerRemove(listener: LayerChangeListener): void {
    this.listeners.delete(listener);
  }

  /** Calls every listener, in the order they were added. */
  notify(): void {
    [...this.listeners].forEach((listener) => listener());
  }

  /** Removes every listener. */
  clear(): void {
    this.listeners.clear();
  }
}
