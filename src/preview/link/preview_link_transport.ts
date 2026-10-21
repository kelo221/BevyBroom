/** Error raised when the game bridge rejects a request or cannot be reached. */
export class PreviewLinkTransportError extends Error {
  /** True when the game could not be reached at all. */
  readonly isUnreachable: boolean;

  /**
   * Creates a transport error.
   *
   * @param message Human-readable reason.
   * @param isUnreachable True when no reply arrived.
   */
  constructor(message: string, isUnreachable: boolean) {
    super(message);
    this.name = 'PreviewLinkTransportError';
    this.isUnreachable = isUnreachable;
  }
}

/** Sends JSON-RPC calls to the game bridge. */
export abstract class PreviewLinkTransport {
  /**
   * Calls one bridge method.
   *
   * @param method JSON-RPC method name.
   * @param params Method parameters.
   * @param timeoutMilliseconds Time after which the call fails as unreachable.
   * @returns The method result.
   */
  abstract call<Result>(method: string, params: unknown, timeoutMilliseconds: number): Promise<Result>;
}

/** JSON-RPC 2.0 reply envelope. */
interface PreviewJsonRpcReply<Result> {
  result?: Result;
  error?: { code?: number; message?: string };
}

/**
 * Sends JSON-RPC calls over HTTP POST to the Bevy remote server. Requests use a
 * plain text body so browsers send them without a CORS preflight.
 */
export class PreviewLinkTransportHttp extends PreviewLinkTransport {
  private readonly endpoint: string;
  private nextRequestIdentifier = 1;

  /**
   * Creates an HTTP transport.
   *
   * @param endpoint Base URL of the Bevy remote server.
   */
  constructor(endpoint: string) {
    super();
    this.endpoint = endpoint;
  }

  /**
   * Calls one bridge method over HTTP.
   *
   * @param method JSON-RPC method name.
   * @param params Method parameters.
   * @param timeoutMilliseconds Time after which the call fails as unreachable.
   * @returns The method result.
   */
  async call<Result>(method: string, params: unknown, timeoutMilliseconds: number): Promise<Result> {
    const body = JSON.stringify({ jsonrpc: '2.0', id: this.nextRequestIdentifier++, method, params });
    const reply = await this.replyFetch<Result>(body, timeoutMilliseconds);
    return PreviewLinkTransportHttp.resultUnwrap<Result>(reply);
  }

  /**
   * Posts a request body and parses the JSON reply.
   *
   * @param body Serialized JSON-RPC request.
   * @param timeoutMilliseconds Time after which the request is aborted.
   * @returns Parsed reply envelope.
   */
  private async replyFetch<Result>(body: string, timeoutMilliseconds: number): Promise<PreviewJsonRpcReply<Result>> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMilliseconds);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        body,
        signal: abort.signal,
        headers: { 'Content-Type': 'text/plain' },
      });
      return (await response.json()) as PreviewJsonRpcReply<Result>;
    } catch (error) {
      throw new PreviewLinkTransportError(`Game preview unreachable: ${String(error)}`, true);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Returns the result of a reply or throws its error.
   *
   * @param reply Parsed reply envelope.
   * @returns The method result.
   */
  private static resultUnwrap<Result>(reply: PreviewJsonRpcReply<Result>): Result {
    if (reply.error) {
      throw new PreviewLinkTransportError(reply.error.message ?? 'Game preview error', false);
    }
    if (reply.result === undefined) {
      throw new PreviewLinkTransportError('Game preview sent an empty reply', false);
    }
    return reply.result;
  }
}
