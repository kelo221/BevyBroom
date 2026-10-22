import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PREVIEW_PROTOCOL_VERSION,
  PREVIEW_REQUIRED_CAPABILITIES,
  type PreviewAuthoredObject,
  type PreviewAuthoredState,
  type PreviewHelloReply,
} from '@/preview/protocol/preview_protocol_types.js';
import { PreviewHandshakeJudge } from '@/preview/link/handshake/preview_handshake_judge.js';
import { e2eRequiredRead } from '../../e2e/preview_e2e_environment.js';

/** Mirror of the game bridge's shared fixtures kept in this repository. */
const FIXTURE_MIRROR_DIRECTORY = resolve(__dirname, 'fixtures');

/** Shared fixtures of the sibling game bridge checkout, when present. */
const FIXTURE_COMPANION_DIRECTORY = resolve(__dirname, '../../../../AiWorldEdBevy/fixtures');

/** Fixture files both repositories parse. */
const FIXTURE_FILE_NAMES = ['hello_sample.json', 'authored_state_sample.json'] as const;

/** Every field of a handshake reply; the record type makes the list exhaustive. */
const HELLO_FIELDS: Record<keyof PreviewHelloReply, true> = {
  protocol: true,
  min_protocol: true,
  bridge_version: true,
  project_id: true,
  instance_id: true,
  capabilities: true,
};

/**
 * Every field of an authored snapshot; the record type makes the list
 * exhaustive.
 */
const STATE_FIELDS: Record<keyof PreviewAuthoredState, true> = {
  protocol: true,
  project_id: true,
  document_id: true,
  session_id: true,
  revision: true,
  geometry_revision: true,
  objects: true,
};

/** Every field of an authored object; the record type makes the list exhaustive. */
const OBJECT_FIELDS: Record<keyof PreviewAuthoredObject, true> = {
  id: true,
  parent_id: true,
  name: true,
  kind: true,
  visible: true,
  translation: true,
  rotation: true,
  scale: true,
  light: true,
  room: true,
  portal: true,
  components: true,
};

/**
 * Reads and parses one mirrored fixture.
 *
 * @param fileName Fixture file name.
 * @returns Parsed JSON.
 */
function fixtureMirrorRead<Value>(fileName: string): Value {
  return JSON.parse(readFileSync(resolve(FIXTURE_MIRROR_DIRECTORY, fileName), 'utf8')) as Value;
}

/**
 * Returns the keys of an object that the editor's type does not declare.
 *
 * @param value Parsed fixture object.
 * @param declared Fields the editor declares.
 * @returns Undeclared keys.
 */
function fieldsUndeclared(value: object, declared: Record<string, true>): string[] {
  return Object.keys(value).filter((key) => !(key in declared));
}

/**
 * The wire fixtures the game bridge's Rust tests parse are understood by the
 * editor too, so the TypeScript and Rust protocol cannot drift apart
 * unnoticed.
 */
describe('preview protocol fixtures', () => {
  it('accepts the bridge sample handshake with the editor protocol and required features', () => {
    const hello = fixtureMirrorRead<PreviewHelloReply>('hello_sample.json');
    expect(fieldsUndeclared(hello, HELLO_FIELDS)).toEqual([]);
    const verdict = PreviewHandshakeJudge.evaluate(hello, {
      protocol: PREVIEW_PROTOCOL_VERSION,
      requiredCapabilities: PREVIEW_REQUIRED_CAPABILITIES,
      expectedProjectIdentifier: hello.project_id,
    });
    expect(verdict).toEqual({ compatible: true });
  });

  it('declares every field of the bridge sample snapshot and its objects', () => {
    const state = fixtureMirrorRead<PreviewAuthoredState>('authored_state_sample.json');
    expect(fieldsUndeclared(state, STATE_FIELDS)).toEqual([]);
    expect(state.objects.length).toBeGreaterThan(0);
    state.objects.forEach((object) => expect(fieldsUndeclared(object, OBJECT_FIELDS)).toEqual([]));
  });

  it('keeps the mirrored fixtures identical to the game bridge checkout', () => {
    const isCompanionPresent = existsSync(FIXTURE_COMPANION_DIRECTORY);
    expect(isCompanionPresent || !e2eRequiredRead()).toBe(true);
    if (!isCompanionPresent) {
      return;
    }
    FIXTURE_FILE_NAMES.forEach((fileName) => {
      const mirrored = readFileSync(resolve(FIXTURE_MIRROR_DIRECTORY, fileName), 'utf8');
      const companion = readFileSync(resolve(FIXTURE_COMPANION_DIRECTORY, fileName), 'utf8');
      expect(mirrored.replace(/\r\n/g, '\n'), fileName).toBe(companion.replace(/\r\n/g, '\n'));
    });
  });
});
