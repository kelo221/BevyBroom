import { describe, expect, it } from 'vitest';
import {
  PreviewHandshakeJudge,
  type PreviewHandshakeExpectation,
} from '@/preview/link/handshake/preview_handshake_judge.js';
import type { PreviewHelloReply } from '@/preview/protocol/preview_protocol_types.js';

/**
 * Builds a handshake reply that accepts the given range and serves the given
 * features.
 *
 * @param minimum Oldest accepted protocol.
 * @param maximum Newest accepted protocol.
 * @param capabilities Served features.
 * @returns Reply.
 */
function helloCreate(minimum: number, maximum: number, capabilities: string[]): PreviewHelloReply {
  return {
    protocol: maximum,
    min_protocol: minimum,
    bridge_version: 'test',
    project_id: 'project-a',
    instance_id: 'instance',
    capabilities,
  };
}

/** An expectation of protocol 10 needing state and geometry from any project. */
const EXPECTATION: PreviewHandshakeExpectation = {
  protocol: 10,
  requiredCapabilities: ['state', 'geometry'],
  expectedProjectIdentifier: null,
};

/** The handshake judge accepts only games that can take the editor's scene. */
describe('PreviewHandshakeJudge', () => {
  it('accepts a game whose range contains the editor protocol and serves every required feature', () => {
    const hello = helloCreate(EXPECTATION.protocol - 1, EXPECTATION.protocol + 1, ['geometry', 'state', 'extra']);
    expect(PreviewHandshakeJudge.evaluate(hello, EXPECTATION)).toEqual({ compatible: true });
  });

  it('tells the user to rebuild an older game and to update an older editor', () => {
    const older = PreviewHandshakeJudge.evaluate(
      helloCreate(1, EXPECTATION.protocol - 1, ['state', 'geometry']),
      EXPECTATION,
    );
    const newer = PreviewHandshakeJudge.evaluate(
      helloCreate(EXPECTATION.protocol + 1, EXPECTATION.protocol + 2, ['state', 'geometry']),
      EXPECTATION,
    );
    expect(older.compatible ? '' : older.reason).toContain('Rebuild the game');
    expect(newer.compatible ? '' : newer.reason).toContain('Update BevyBroom');
  });

  it('names every missing feature', () => {
    const verdict = PreviewHandshakeJudge.evaluate(
      helloCreate(EXPECTATION.protocol, EXPECTATION.protocol, []),
      EXPECTATION,
    );
    expect(verdict.compatible ? '' : verdict.reason).toContain('state, geometry');
  });

  it('accepts a matching project and refuses another one', () => {
    const hello = helloCreate(EXPECTATION.protocol, EXPECTATION.protocol, ['state', 'geometry']);
    const matching = { ...EXPECTATION, expectedProjectIdentifier: hello.project_id };
    const other = { ...EXPECTATION, expectedProjectIdentifier: `${hello.project_id}-b` };
    expect(PreviewHandshakeJudge.evaluate(hello, matching)).toEqual({ compatible: true });
    expect(PreviewHandshakeJudge.evaluate(hello, other).compatible).toBe(false);
  });
});
