/**
 * IroFi Travel Rule — Secure Envelope
 * Implements TRISA's encrypted envelope protocol.
 * Uses AES-256-GCM for payload encryption + RSA-OAEP for key wrapping.
 * The private key never leaves the institution's infrastructure.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHmac, publicEncrypt, privateDecrypt, constants } from "crypto";
import type { IVMS101Payload, TRISAEnvelope } from "./types";

// ── Encryption ─────────────────────────────────────────────────────────────

/**
 * Seal an IVMS101 payload into an encrypted TRISA envelope.
 * Only the intended recipient (whose public key we use) can decrypt it.
 */
export async function sealEnvelope(
  payload: IVMS101Payload,
  recipientPublicKeyPem: string,
  senderPrivateKeyPem: string,
  hmacSecret: string
): Promise<TRISAEnvelope> {
  const envelopeId = generateUUID();

  // 1. Serialize payload to JSON
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");

  // 2. Generate a random AES-256 session key
  const aesKey = randomBytes(32);  // 256 bits
  const iv = randomBytes(12);       // 96-bit IV for GCM

  // 3. Encrypt payload with AES-256-GCM
  const cipher = createCipheriv("aes-256-gcm", aesKey, iv);
  const encryptedPayload = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Combine: IV (12) + authTag (16) + ciphertext
  const payloadWithMeta = Buffer.concat([iv, authTag, encryptedPayload]);
  const payloadBase64 = payloadWithMeta.toString("base64");

  // 4. Wrap the AES key with recipient's RSA public key (RSA-OAEP SHA-256)
  const recipientKeyBuffer = Buffer.from(
    recipientPublicKeyPem
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "")
      .replace(/\s/g, ""),
    "base64"
  );

  const encryptedKey = publicEncrypt(
    {
      key: recipientPublicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    aesKey
  ).toString("base64");

  // 5. HMAC-SHA256 over the encrypted payload for integrity
  const hmac = createHmac("sha256", hmacSecret)
    .update(payloadBase64)
    .digest("hex");

  // 6. Sign with sender's private key to authenticate origin
  // In production: use node:crypto sign() with RS256
  const publicKeySignature = `irofi-sig-${envelopeId}`; // Stub — use proper RSA-PSS in prod

  return {
    id: envelopeId,
    payload: payloadBase64,
    encryption_key: encryptedKey,
    encryption_algorithm: "AES256-GCM",
    hmac_signature: hmac,
    public_key_signature: publicKeySignature,
    timestamp: new Date().toISOString(),
    transfer_state: "AWAITING_REQUEST",
  };
}

/**
 * Open an encrypted TRISA envelope using the institution's private key.
 */
export async function openEnvelope(
  envelope: TRISAEnvelope,
  recipientPrivateKeyPem: string,
  hmacSecret: string
): Promise<IVMS101Payload> {
  // 1. Verify HMAC integrity
  const expectedHmac = createHmac("sha256", hmacSecret)
    .update(envelope.payload)
    .digest("hex");

  if (expectedHmac !== envelope.hmac_signature) {
    throw new Error("TRISA envelope HMAC verification failed — payload may have been tampered");
  }

  // 2. Decrypt the AES session key using our RSA private key
  const encryptedKeyBuffer = Buffer.from(envelope.encryption_key, "base64");
  const aesKey = privateDecrypt(
    {
      key: recipientPrivateKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    encryptedKeyBuffer
  );

  // 3. Decrypt the payload
  const payloadBuffer = Buffer.from(envelope.payload, "base64");
  const iv = payloadBuffer.subarray(0, 12);
  const authTag = payloadBuffer.subarray(12, 28);
  const ciphertext = payloadBuffer.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8")) as IVMS101Payload;
}

function generateUUID(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
