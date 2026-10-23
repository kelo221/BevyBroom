import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PREVIEW_PROTOCOL_VERSION,
  PREVIEW_REQUIRED_CAPABILITIES,
  type PreviewAuthoredLight,
  type PreviewAuthoredObject,
  type PreviewAuthoredState,
  type PreviewHelloReply,
} from '@/preview/protocol/preview_protocol_types.js';
import { PreviewHandshakeJudge } from '@/preview/link/handshake/preview_handshake_judge.js';
import {
  LIGHT_EXPORT_OWNER_EXTRAS_KEY,
  LIGHT_EXPORT_SETTINGS_EXTRAS_KEY,
  LightExportNodeBuilder,
} from '@/light/export/light_export_node_builder.js';

/** Wire fixtures of the game bridge workspace, parsed by its Rust tests too. */
const FIXTURE_BRIDGE_DIRECTORY = resolve(__dirname, '../../../bevy/fixtures');

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
 * Reads and parses one fixture of the game bridge workspace.
 *
 * @param fileName Fixture file name.
 * @returns Parsed JSON.
 */
function fixtureBridgeRead<Value>(fileName: string): Value {
  return JSON.parse(readFileSync(resolve(FIXTURE_BRIDGE_DIRECTORY, fileName), 'utf8')) as Value;
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
    const hello = fixtureBridgeRead<PreviewHelloReply>('hello_sample.json');
    expect(fieldsUndeclared(hello, HELLO_FIELDS)).toEqual([]);
    const verdict = PreviewHandshakeJudge.evaluate(hello, {
      protocol: PREVIEW_PROTOCOL_VERSION,
      requiredCapabilities: PREVIEW_REQUIRED_CAPABILITIES,
      expectedProjectIdentifier: hello.project_id,
    });
    expect(verdict).toEqual({ compatible: true });
  });

  it('declares every field of the bridge sample snapshot and its objects', () => {
    const state = fixtureBridgeRead<PreviewAuthoredState>('authored_state_sample.json');
    expect(fieldsUndeclared(state, STATE_FIELDS)).toEqual([]);
    expect(state.objects.length).toBeGreaterThan(0);
    state.objects.forEach((object) => expect(fieldsUndeclared(object, OBJECT_FIELDS)).toEqual([]));
  });

  it('writes exactly the light node extras the bridge sample reads', () => {
    const sample = fixtureBridgeRead<Record<string, unknown>>('light_extras_sample.json');
    const light = sample[LIGHT_EXPORT_SETTINGS_EXTRAS_KEY] as PreviewAuthoredLight;
    const ownerIdentifier = sample[LIGHT_EXPORT_OWNER_EXTRAS_KEY] as string;
    const written: Record<string, unknown> = {};
    LightExportNodeBuilder.extrasWrite(light, written);
    LightExportNodeBuilder.identityExtrasWrite(light, ownerIdentifier, written);
    expect(JSON.parse(JSON.stringify(written))).toEqual(sample);
  });
});
