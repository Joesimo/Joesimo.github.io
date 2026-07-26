/**
 * Ende-zu-Ende-Verschlüsselung für die Cloud-Synchronisation.
 *
 * Schülerdaten sind personenbezogene Daten (häufig von Minderjährigen).
 * Deshalb verlässt nichts das Gerät im Klartext: Der Datenbestand wird mit
 * AES-GCM 256 verschlüsselt, der Schlüssel per PBKDF2-SHA-256 aus einem
 * Passwort abgeleitet, das nur lokal existiert. Der Server speichert
 * ausschließlich Chiffretext und kann ihn nicht lesen.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

const PBKDF2_ITERATIONS = 250_000;

export const cryptoAvailable = () =>
  typeof crypto !== 'undefined' && !!crypto.subtle;

function assertAvailable() {
  if (!cryptoAvailable()) {
    throw new Error(
      'Verschlüsselung nicht verfügbar. Die App muss über HTTPS (oder localhost) geladen werden.',
    );
  }
}

/* ---------- Base64 ---------- */

export function toB64(bytes) {
  let bin = '';
  const arr = new Uint8Array(bytes);
  const CHUNK = 0x8000;
  for (let i = 0; i < arr.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, arr.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function fromB64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- Schlüssel ---------- */

export const randomSalt = () => crypto.getRandomValues(new Uint8Array(16));

export async function deriveKey(passphrase, salt) {
  assertAvailable();
  const base = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/* ---------- Ver-/Entschlüsseln ---------- */

/**
 * @returns {Promise<{cipher:string, iv:string, salt:string, alg:string, iter:number}>}
 */
export async function encryptJson(value, passphrase, saltBytes) {
  assertAvailable();
  const salt = saltBytes || randomSalt();
  const key = await deriveKey(passphrase, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = enc.encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return {
    cipher: toB64(cipher),
    iv: toB64(iv),
    salt: toB64(salt),
    alg: 'AES-GCM-256/PBKDF2-SHA256',
    iter: PBKDF2_ITERATIONS,
  };
}

export async function decryptJson(payload, passphrase) {
  assertAvailable();
  const salt = fromB64(payload.salt);
  const iv = fromB64(payload.iv);
  const key = await deriveKey(passphrase, salt);
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromB64(payload.cipher));
  } catch {
    throw new Error('Entschlüsselung fehlgeschlagen – falsches Sync-Passwort?');
  }
  return JSON.parse(dec.decode(plain));
}

/** Zufälliges, gut abtippbares Passwort (ohne verwechselbare Zeichen). */
export function suggestPassphrase(words = 4) {
  const alphabet = 'abcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(words * 4));
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i % 4 === 3 && i < bytes.length - 1) out += '-';
  }
  return out;
}
