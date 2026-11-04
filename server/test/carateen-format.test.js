import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { decodeCarateenResponse } from '../../shared/carateen-format.js';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/carateen/public-envelope-codec.json', import.meta.url), 'utf8'));

test('Carateen guest metadata format preserves Arabic Unicode, real IDs and sparse episode numbers', async () => {
  const [rows, guide] = await Promise.all([
    decodeCarateenResponse(fixture.array.envelope),
    decodeCarateenResponse(fixture.object.envelope),
  ]);
  assert.deepEqual(rows, fixture.array.expected);
  assert.deepEqual(guide, fixture.object.expected);
  assert.equal(guide.episodes[0].episode_number, 3);
});

test('Carateen metadata decoding also works with only browser WebCrypto and standard text/byte APIs', async () => {
  const source = fs.readFileSync(new URL('../../shared/carateen-format.js', import.meta.url), 'utf8');
  const decode = vm.runInNewContext(source.replace('export async function decodeCarateenResponse', 'async function decodeCarateenResponse') + '\ndecodeCarateenResponse;', {
    crypto: webcrypto,
    Uint8Array,
    TextEncoder,
    TextDecoder,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(await decode(fixture.array.envelope))), fixture.array.expected);
});

test('ordinary decoded JSON stays unchanged while incomplete envelopes and scalar bodies are rejected', async () => {
  for (const value of [fixture.array.expected, fixture.object.expected, { error: 'Access denied' }]) {
    assert.equal(await decodeCarateenResponse(value), value);
  }
  for (const value of [null, 'not metadata', 1, false, { iv: fixture.array.envelope.iv }, { encryptedData: fixture.array.envelope.encryptedData }, { iv: null, encryptedData: null }]) {
    await assert.rejects(decodeCarateenResponse(value), /Carateen public metadata/);
  }
});

test('malformed hexadecimal, invalid CBC sizes and oversized metadata fail before decoding', async () => {
  const original = fixture.array.envelope;
  for (const iv of ['', '0'.repeat(31), '0'.repeat(33), 'g'.repeat(32)]) {
    await assert.rejects(decodeCarateenResponse({ ...original, iv }), /IV is invalid/);
  }
  for (const encryptedData of ['', 'f', 'f'.repeat(31), 'z'.repeat(32), 'f'.repeat(33)]) {
    await assert.rejects(decodeCarateenResponse({ ...original, encryptedData }), /ciphertext/);
  }
  await assert.rejects(decodeCarateenResponse(original, { maxBytes: 16 }), /size limit/);
  for (const maxBytes of [0, 15, Infinity, 1.5, 8 * 1024 * 1024 + 1]) {
    await assert.rejects(decodeCarateenResponse(original, { maxBytes }), /size limit is invalid/);
  }
});

test('invalid plaintext, invalid UTF-8 and corrupt padding never become playable metadata', async () => {
  for (const envelope of [fixture.invalidJson, fixture.invalidUtf8, fixture.primitive]) {
    await assert.rejects(decodeCarateenResponse(envelope), /^Error: Carateen public metadata decoding failed$/);
  }
  const ciphertext = fixture.array.envelope.encryptedData;
  const corrupted = { ...fixture.array.envelope, encryptedData: ciphertext.slice(0, -32) + '0'.repeat(32) };
  await assert.rejects(decodeCarateenResponse(corrupted), /decoding failed/);
});
