import type { ChatMessage } from '../_providers/types';

type ContextTokenPayload = {
  readonly version: 1;
  readonly visitorUuid: string;
  readonly agentSessionId: string;
  readonly issuedAt: string;
  readonly messages: readonly ChatMessage[];
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function importKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', material, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function sealAgentContext(
  secret: string,
  input: {
    readonly visitorUuid: string;
    readonly agentSessionId: string;
    readonly messages: readonly ChatMessage[];
  },
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload: ContextTokenPayload = {
    version: 1,
    visitorUuid: input.visitorUuid,
    agentSessionId: input.agentSessionId,
    issuedAt: new Date().toISOString(),
    messages: input.messages,
  };
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importKey(secret), plaintext);
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

export async function openAgentContext(
  secret: string,
  token: string,
  binding: { readonly visitorUuid: string; readonly agentSessionId: string },
): Promise<ChatMessage[]> {
  try {
    const [version, encodedIv, encodedCiphertext, extra] = token.split('.');
    if (version !== 'v1' || !encodedIv || !encodedCiphertext || extra) throw new Error('Invalid token envelope');
    const iv = fromBase64Url(encodedIv);
    if (iv.byteLength !== 12) throw new Error('Invalid token IV');
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      await importKey(secret),
      toArrayBuffer(fromBase64Url(encodedCiphertext)),
    );
    const payload = JSON.parse(new TextDecoder().decode(plaintext)) as ContextTokenPayload;
    if (
      payload.version !== 1
      || payload.visitorUuid !== binding.visitorUuid
      || payload.agentSessionId !== binding.agentSessionId
      || !Array.isArray(payload.messages)
    ) {
      throw new Error('Invalid token payload');
    }
    const issuedAt = Date.parse(payload.issuedAt);
    if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > 6 * 60 * 60 * 1000 || issuedAt > Date.now() + 60_000) {
      throw new Error('Expired token');
    }
    return [...payload.messages];
  } catch {
    throw new Error('invalid_context');
  }
}
