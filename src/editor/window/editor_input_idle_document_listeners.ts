/** Capture-phase pointer handlers the input bridge installs on each document. */
export interface EditorInputIdleDocumentHandlers {
  /** Handles document pointerdown. */
  readonly pointerDown: (event: PointerEvent) => void;
  /** Handles document pointerup. */
  readonly pointerUp: (event: PointerEvent) => void;
  /** Handles document pointermove. */
  readonly pointerMove: (event: PointerEvent) => void;
}

/**
 * Keeps one set of idle capture-phase pointer listeners attached to exactly the
 * documents it is told about: the main install document and every detached
 * popup document that owns a pinned viewport.
 */
export class EditorInputIdleDocumentListeners {
  private handlers: EditorInputIdleDocumentHandlers | null;
  private readonly listenedDocuments: Set<Document>;

  /** Creates a listener set without handlers or documents. */
  constructor() {
    this.handlers = null;
    this.listenedDocuments = new Set();
  }

  /**
   * Stores the handlers attached by later syncs.
   *
   * @param handlers Pointer handlers, or null to forget them.
   */
  handlersWrite(handlers: EditorInputIdleDocumentHandlers | null): void {
    this.handlers = handlers;
  }

  /**
   * Attaches listeners to newly desired documents and detaches them from
   * documents no longer desired. Does nothing without handlers.
   *
   * @param desiredDocuments Documents that should receive idle routing.
   */
  sync(desiredDocuments: readonly Document[]): void {
    if (!this.handlers) {
      return;
    }
    const desired = new Set(desiredDocuments);
    this.documentsNoLongerDesiredDetach(desired);
    this.documentsNewlyDesiredAttach(desired);
  }

  /** Detaches listeners from every document that still has them. */
  detachAll(): void {
    for (const listenedDocument of this.listenedDocuments) {
      this.documentListenersRemove(listenedDocument);
    }
    this.listenedDocuments.clear();
  }

  /**
   * Detaches listeners from documents missing from the desired set.
   *
   * @param desired Documents that should keep idle routing.
   */
  private documentsNoLongerDesiredDetach(desired: ReadonlySet<Document>): void {
    for (const listenedDocument of this.listenedDocuments) {
      if (desired.has(listenedDocument)) {
        continue;
      }
      this.documentListenersRemove(listenedDocument);
      this.listenedDocuments.delete(listenedDocument);
    }
  }

  /**
   * Attaches listeners to desired documents that do not have them yet.
   *
   * @param desired Documents that should receive idle routing.
   */
  private documentsNewlyDesiredAttach(desired: ReadonlySet<Document>): void {
    for (const desiredDocument of desired) {
      if (this.listenedDocuments.has(desiredDocument) || !this.documentCanListen(desiredDocument)) {
        continue;
      }
      this.documentListenersAdd(desiredDocument);
      this.listenedDocuments.add(desiredDocument);
    }
  }

  /**
   * Returns whether a document can host capture-phase pointer listeners.
   *
   * @param candidateDocument Main or detached popup document.
   * @returns True when add/removeEventListener are available.
   */
  private documentCanListen(candidateDocument: Document): boolean {
    return (
      typeof candidateDocument.addEventListener === 'function' &&
      typeof candidateDocument.removeEventListener === 'function'
    );
  }

  /**
   * Attaches the capture-phase pointer listeners to one document.
   *
   * @param targetDocument Document that should receive idle routing.
   */
  private documentListenersAdd(targetDocument: Document): void {
    if (!this.handlers) {
      return;
    }
    targetDocument.addEventListener('pointerdown', this.handlers.pointerDown, true);
    targetDocument.addEventListener('pointerup', this.handlers.pointerUp, true);
    targetDocument.addEventListener('pointermove', this.handlers.pointerMove, true);
  }

  /**
   * Removes the capture-phase pointer listeners from one document.
   *
   * @param targetDocument Document that previously hosted idle routing.
   */
  private documentListenersRemove(targetDocument: Document): void {
    if (!this.handlers) {
      return;
    }
    targetDocument.removeEventListener('pointerdown', this.handlers.pointerDown, true);
    targetDocument.removeEventListener('pointerup', this.handlers.pointerUp, true);
    targetDocument.removeEventListener('pointermove', this.handlers.pointerMove, true);
  }
}
