// AES-256-GCM for the per-user bot key at rest.
//
// The key DreamPilot stores is a bot key, which cannot withdraw or transfer
// funds. Encrypting it still matters: a leaked bot key lets an attacker trade
// inside the user's limits, so it is treated as sensitive, never logged, and
// never sent back to Telegram.

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

const IV_LEN = 12;
const TAG_LEN = 16;

export class Cipher {
  private readonly key: Buffer;

  /** `hex` must be 32 bytes of hex (64 characters). */
  constructor(hex: string) {
    const clean = hex.trim();
    if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
      throw new Error("MASTER_ENCRYPTION_KEY must be 32 bytes of hex (64 characters). Generate one with: openssl rand -hex 32");
    }
    this.key = Buffer.from(clean, "hex");
  }

  /** Returns `iv || tag || ciphertext`, so the whole blob is self-describing. */
  encrypt(plaintext: string | Buffer): Buffer {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]);
  }

  decrypt(blob: Buffer): string {
    if (blob.length < IV_LEN + TAG_LEN) throw new Error("ciphertext is too short to be valid");
    const iv = blob.subarray(0, IV_LEN);
    const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const body = blob.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  }
}

/** Constant-time compare, for anything that behaves like a secret. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** A fresh 32-byte hex key, for the setup instructions. */
export function generateMasterKey(): string {
  return randomBytes(32).toString("hex");
}
