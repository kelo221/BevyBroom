import { describe, expect, it } from 'vitest';
import { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import type { PreviewLinkChannelListener } from '@/preview/link/preview_link_channel.js';
import { PreviewLinkStateChannel, type PreviewStateDocument } from '@/preview/link/preview_link_state_channel.js';
import {
  PREVIEW_GEOMETRY_SETTLE_MILLISECONDS,
  PreviewLinkGeometryChannel,
  type PreviewGeometryCheck,
} from '@/preview/link/preview_link_geometry_channel.js';
import { PREVIEW_METHOD, type PreviewAuthoredObject } from '@/preview/protocol/preview_protocol_types.js';

/** One call waiting for the test to answer it. */
interface PreviewHeldCall {
  method: string;
  params: unknown;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

/** Transport whose calls wait until the test answers them, oldest first. */
class PreviewLinkTransportHeld extends PreviewLinkTransport {
  readonly calls: PreviewHeldCall[] = [];

  /** @inheritdoc */
  call<Result>(method: string, params: unknown): Promise<Result> {
    return new Promise<Result>((resolve, reject) => {
      this.calls.push({ method, params, resolve: (result) => resolve(result as Result), reject });
    });
  }

  /**
   * Answers the oldest waiting call of a method.
   *
   * @param method Method whose call is answered.
   * @param result Reply, or a function building it from the call parameters.
   */
  answer(method: string, result: unknown | ((params: unknown) => unknown)): void {
    const index = this.calls.findIndex((call) => call.method === method);
    const [held] = this.calls.splice(index, 1);
    if (!held) {
      throw new Error(`No waiting ${method} call`);
    }
    held.resolve(typeof result === 'function' ? (result as (params: unknown) => unknown)(held.params) : result);
  }

  /**
   * Fails the oldest waiting call of a method.
   *
   * @param method Method whose call fails.
   */
  fail(method: string): void {
    const index = this.calls.findIndex((call) => call.method === method);
    const [held] = this.calls.splice(index, 1);
    held?.reject(new Error('the previous game went away'));
  }
}

/** Listener counting outcomes. */
class PreviewChannelListenerCounting implements PreviewLinkChannelListener {
  succeeded = 0;
  failed = 0;

  /** @inheritdoc */
  onRequestSucceeded(): void {
    this.succeeded += 1;
  }

  /** @inheritdoc */
  onRequestFailed(): void {
    this.failed += 1;
  }
}

/** Document every state snapshot of the tests belongs to. */
const PREVIEW_TEST_DOCUMENT: PreviewStateDocument = {
  projectIdentifier: 'project',
  documentIdentifier: 'document',
  geometryRevision: 0,
};

/** Authored objects of the tests. */
const PREVIEW_TEST_OBJECTS: PreviewAuthoredObject[] = [];

/**
 * Accepts a state or geometry request with the revision it carried.
 *
 * @param params Request parameters.
 * @returns Accepting reply.
 */
function replyAcceptingEcho(params: unknown): unknown {
  const sent = params as { revision?: number; geometry_revision?: number };
  return { accepted: true, verdict: 'newer', revision: sent.revision ?? sent.geometry_revision ?? 0 };
}

/**
 * Builds a geometry check that is settled at the given time.
 *
 * @param nowMilliseconds Current time.
 * @returns Geometry check.
 */
function geometryCheckCreate(nowMilliseconds: number): PreviewGeometryCheck {
  return {
    signature: 'geometry',
    nowMilliseconds,
    isEditInProgress: false,
    documentIdentifier: 'document',
    levelName: 'level',
  };
}

/**
 * Unit tests for channel generations: a reply that arrives after the game was
 * replaced reports nothing and commits nothing, and a reply naming another
 * revision is not taken as acceptance.
 */
describe('PreviewLinkChannel generations', () => {
  it('sends the state again to a new game even when the old game accepts late', async () => {
    const transport = new PreviewLinkTransportHeld();
    const listener = new PreviewChannelListenerCounting();
    const channel = new PreviewLinkStateChannel(transport, 'session', listener);
    const firstSend = channel.sendIfChanged(PREVIEW_TEST_DOCUMENT, PREVIEW_TEST_OBJECTS);
    channel.generationAdvance();
    channel.resendRequest();
    transport.answer(PREVIEW_METHOD.applyState, replyAcceptingEcho);
    await firstSend;
    expect(listener.succeeded).toBe(0);
    expect(channel.lastVerdictRead()).toBe('');
    const secondSend = channel.sendIfChanged(PREVIEW_TEST_DOCUMENT, PREVIEW_TEST_OBJECTS);
    expect(secondSend).not.toBeNull();
    transport.answer(PREVIEW_METHOD.applyState, replyAcceptingEcho);
    await secondSend;
    expect(listener.succeeded).toBe(1);
    expect(channel.sendIfChanged(PREVIEW_TEST_DOCUMENT, PREVIEW_TEST_OBJECTS)).toBeNull();
  });

  it('does not report the failure of a request to a game that was replaced', async () => {
    const transport = new PreviewLinkTransportHeld();
    const listener = new PreviewChannelListenerCounting();
    const channel = new PreviewLinkStateChannel(transport, 'session', listener);
    const send = channel.sendIfChanged(PREVIEW_TEST_DOCUMENT, PREVIEW_TEST_OBJECTS);
    channel.generationAdvance();
    transport.fail(PREVIEW_METHOD.applyState);
    await send;
    expect(listener.failed).toBe(0);
    expect(channel.isBusy()).toBe(false);
  });

  it('does not take a reply naming another revision as acceptance', async () => {
    const transport = new PreviewLinkTransportHeld();
    const channel = new PreviewLinkStateChannel(transport, 'session', new PreviewChannelListenerCounting());
    const send = channel.sendIfChanged(PREVIEW_TEST_DOCUMENT, PREVIEW_TEST_OBJECTS);
    transport.answer(PREVIEW_METHOD.applyState, {
      accepted: true,
      verdict: 'newer',
      revision: channel.revisionRead() + 7,
    });
    await send;
    expect(channel.sendIfChanged(PREVIEW_TEST_DOCUMENT, PREVIEW_TEST_OBJECTS)).not.toBeNull();
  });

  it('publishes the geometry again to a new game even when the old game accepts late', async () => {
    const transport = new PreviewLinkTransportHeld();
    const channel = new PreviewLinkGeometryChannel(
      transport,
      'session',
      async () => 'Z2xi',
      new PreviewChannelListenerCounting(),
    );
    channel.publishIfSettled(geometryCheckCreate(0));
    const settledTime = PREVIEW_GEOMETRY_SETTLE_MILLISECONDS;
    const firstPublication = channel.publishIfSettled(geometryCheckCreate(settledTime));
    await Promise.resolve();
    channel.generationAdvance();
    channel.republishRequest();
    transport.answer(PREVIEW_METHOD.publishGeometry, replyAcceptingEcho);
    await firstPublication;
    const secondPublication = channel.publishIfSettled(geometryCheckCreate(settledTime * 2));
    expect(secondPublication).not.toBeNull();
    await Promise.resolve();
    transport.answer(PREVIEW_METHOD.publishGeometry, replyAcceptingEcho);
    await secondPublication;
    expect(channel.publishIfSettled(geometryCheckCreate(settledTime * 3))).toBeNull();
  });
});
