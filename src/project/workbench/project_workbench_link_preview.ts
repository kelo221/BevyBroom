import type { PreviewLinkService } from '@/preview/link/preview_link_service.js';
import type { ProjectWorkbenchLink } from '@/project/workbench/project_workbench.js';

/** Lets a project workbench drive the game preview link service. */
export class ProjectWorkbenchLinkPreview implements ProjectWorkbenchLink {
  private readonly service: PreviewLinkService;

  /**
   * Wraps a preview link service.
   *
   * @param service Game preview link service.
   */
  constructor(service: PreviewLinkService) {
    this.service = service;
  }

  /**
   * Remembers the endpoint the next connect uses.
   *
   * @param endpoint Endpoint URL.
   */
  endpointWrite(endpoint: string): void {
    this.service.endpointWrite(endpoint);
  }

  /** Connects, replacing any current connection. */
  connect(): void {
    this.service.connect();
  }

  /**
   * Returns true while the link is connected or still trying.
   *
   * @returns Whether a connection exists that is not disconnected.
   */
  isLinkActive(): boolean {
    const connectionState = this.service.controllerRead()?.connectionStateRead() ?? 'disconnected';
    return connectionState !== 'disconnected';
  }
}
