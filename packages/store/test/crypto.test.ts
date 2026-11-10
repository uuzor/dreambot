import { describe, expect, it } from "vitest";
import { Cipher, generateMasterKey, safeEqual } from "../src/crypto.js";

describe("Cipher", () => {
  const key = generateMasterKey();

  it("round-trips a bot key", () => {
    const c = new Cipher(key);
    const secret = "0x" + "ab".repeat(32);
    expect(c.decrypt(c.encrypt(secret))).toBe(secret);
  });

  it("produces a different ciphertext each time, because the IV is random", () => {
    const c = new Cipher(key);
    const a = c.encrypt("same plaintext");
    const b = c.encrypt("same plaintext");
    expect(a.equals(b)).toBe(false);
  });

  it("rejects a tampered ciphertext rather than returning garbage", () => {
    const c = new Cipher(key);
    const blob = c.encrypt("secret");
    blob[blob.length - 1] = (blob[blob.length - 1] ?? 0) ^ 0xff;
    expect(() => c.decrypt(blob)).toThrow();
  });

  it("cannot be decrypted with a different key", () => {
    const blob = new Cipher(key).encrypt("secret");
    expect(() => new Cipher(generateMasterKey()).decrypt(blob)).toThrow();
  });

  it("rejects a malformed master key with an actionable message", () => {
    expect(() => new Cipher("too-short")).toThrow(/MASTER_ENCRYPTION_KEY/);
  });
});

describe("safeEqual", () => {
  it("compares equal strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
  });
  it("rejects different strings and different lengths", () => {
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
