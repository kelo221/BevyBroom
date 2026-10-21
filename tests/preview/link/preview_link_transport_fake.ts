import { PreviewLinkTransport, PreviewLinkTransportError } from '@/preview/link/preview_link_transport.js';
import { PREVIEW_METHOD } from '@/preview/protocol/preview_protocol_types.js';

/** One call received by the fake transport. */
export interface PreviewFakeCall {
  method: string;
  params: unknown;
}

/**
 * In-memory game bridge for preview link tests. It answers like the real
 * bridge, records every call and can pretend to be a restarted or stopped
 * game.
 */
export class PreviewLinkTransportFake extends PreviewLinkTransport {
  readonly calls: PreviewFakeCall[] = [];
  instanceIdentifier = 'game-instance-a';
  isReachable = true;
  highestStateRevision = 0;
  failedGeometryRevision = 0;
  catalogReply: unknown = {
    catalog: { catalog_version: 1, materials: [] },
    error: null,
    generation: 1,
    texture_generation: 0,
  };

  /**
   * Answers one call.
   *
   * @param method JSON-RPC method name.
   * @param params Method parameters.
   * @returns The scripted reply.
   */
  async call<Result>(method: string, params: unknown): Promise<Result> {
    if (!this.isReachable) {
      throw new PreviewLinkTransportError('offline', true);
    }
    this.calls.push({ method, params });
    return this.replyCreate(method, params) as Result;
  }

  /**
   * Returns the calls of one method.
   *
   * @param method JSON-RPC method name.
   * @returns Matching calls in order.
   */
  callsOf(method: string): PreviewFakeCall[] {
    return this.calls.filter((call) => call.method === method);
  }

  /**
   * Builds the reply of one method.
   *
   * @param method JSON-RPC method name.
   * @param params Method parameters.
   * @returns Reply value.
   */
  private replyCreate(method: string, params: unknown): unknown {
    if (method === PREVIEW_METHOD.status) {
      return {
        instance_id: this.instanceIdentifier,
        project_id: 'project-test',
        geometry_revision_failed: this.failedGeometryRevision,
        errors: [],
      };
    }
    if (method === PREVIEW_METHOD.catalog) {
      return this.catalogReply;
    }
    if (method === PREVIEW_METHOD.readAsset) {
      return { path: (params as { path: string }).path, base64: 'iVBORw0KGgo=' };
    }
    if (method === PREVIEW_METHOD.applyState) {
      const revision = (params as { revision: number }).revision;
      const accepted = revision > this.highestStateRevision;
      this.highestStateRevision = Math.max(this.highestStateRevision, revision);
      return { accepted, verdict: accepted ? 'newer' : 'stale', revision };
    }
    return { accepted: true, verdict: 'newer', revision: 1 };
  }
}
