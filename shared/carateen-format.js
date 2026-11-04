// Carateen's anonymous guest website uses this public JSON-envelope format.
// Its fixed format constant is shipped to every visitor in the public bundle;
// it is not an authentication credential, user secret, or media/DRM key.
// Access checks belong to the HTTP caller. Never add a user Authorization token.
// Format verified against all 779 guest catalogue records on 2026-11-03.
// Source: https://carateen.tv/assets/index-CHIXHE94.js, function Bc.
const PUBLIC_FORMAT_BYTES = new TextEncoder().encode("7annaba3l_loves_crypto_safe_key!");
const MAX_BYTES = 8 * 1024 * 1024;
let importedKey;

function invalid(message) { return new Error('Carateen public metadata ' + message); }
function hexBytes(value) {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

// Accept already-decoded JSON as the source's own interceptor does. A partial,
// malformed or oversized envelope must fail rather than become catalogue data.
export async function decodeCarateenResponse(payload, { maxBytes = MAX_BYTES } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 16 || maxBytes > MAX_BYTES) throw invalid('size limit is invalid');
  if (!payload || typeof payload !== 'object') throw invalid('response must be a JSON object or array');
  const hasIv = Object.prototype.hasOwnProperty.call(payload, 'iv');
  const hasCiphertext = Object.prototype.hasOwnProperty.call(payload, 'encryptedData');
  if (!hasIv && !hasCiphertext) return payload;
  if (Array.isArray(payload) || !hasIv || !hasCiphertext || typeof payload.iv !== 'string' || typeof payload.encryptedData !== 'string') throw invalid('envelope is malformed');
  if (payload.iv.length !== 32 || !/^[0-9a-f]{32}$/i.test(payload.iv)) throw invalid('IV is invalid');
  const ciphertext = payload.encryptedData;
  if (!ciphertext.length || ciphertext.length > maxBytes * 2) throw invalid('ciphertext exceeds the size limit or is empty');
  if (ciphertext.length % 32 || !/^[0-9a-f]+$/i.test(ciphertext)) throw invalid('ciphertext is invalid');
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw invalid('decoding requires WebCrypto');
  try {
    importedKey ||= subtle.importKey('raw', PUBLIC_FORMAT_BYTES, { name: 'AES-CBC' }, false, ['decrypt']);
    const plaintext = await subtle.decrypt({ name: 'AES-CBC', iv: hexBytes(payload.iv) }, await importedKey, hexBytes(ciphertext));
    if (plaintext.byteLength > maxBytes) throw invalid('plaintext exceeds the size limit');
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
    if (!data || typeof data !== 'object') throw invalid('plaintext must be a JSON object or array');
    return data;
  } catch {
    throw invalid('decoding failed');
  }
}
