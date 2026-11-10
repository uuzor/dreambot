import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Journal, hashEntry } from "../src/journal.js";

function freshPath(): string {
  return join(mkdtempSync(join(tmpdir(), "dreampilot-journal-")), "agent.jsonl");
}

describe("Journal", () => {
  it("chains each entry to the previous hash", () => {
    const path = freshPath();
    const j = new Journal(path);
    const a = j.append("tick", { n: 1 });
    const b = j.append("thought", { note: "holding" });
    const c = j.append("action", { tool: "open_position" });

    expect(a.seq).toBe(1);
    expect(a.prev).toBe("0".repeat(64));
    expect(b.prev).toBe(a.hash);
    expect(c.prev).toBe(b.hash);
    expect(Journal.verify(Journal.read(path))).toBeNull();
  });

  it("resumes the chain from an existing file", () => {
    const path = freshPath();
    const first = new Journal(path);
    const a = first.append("tick", { n: 1 });

    const second = new Journal(path);
    const b = second.append("tick", { n: 2 });
    expect(b.seq).toBe(2);
    expect(b.prev).toBe(a.hash);
    expect(Journal.verify(Journal.read(path))).toBeNull();
  });

  it("detects an edited entry", () => {
    const path = freshPath();
    const j = new Journal(path);
    j.append("tick", { n: 1 });
    j.append("thought", { note: "holding" });
    j.append("action", { tool: "open_position" });

    const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
    const second = JSON.parse(lines[1]!);
    second.data = { note: "TAMPERED" };
    lines[1] = JSON.stringify(second);
    writeFileSync(path, lines.join("\n") + "\n");

    expect(Journal.verify(Journal.read(path))).toBe(2);
  });

  it("detects a deleted entry", () => {
    const path = freshPath();
    const j = new Journal(path);
    j.append("tick", { n: 1 });
    j.append("thought", { n: 2 });
    j.append("action", { n: 3 });

    const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
    lines.splice(1, 1);
    writeFileSync(path, lines.join("\n") + "\n");

    expect(Journal.verify(Journal.read(path))).not.toBeNull();
  });

  it("refuses to open a corrupt journal", () => {
    const path = freshPath();
    const j = new Journal(path);
    j.append("tick", { n: 1 });
    const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
    const first = JSON.parse(lines[0]!);
    first.hash = "f".repeat(64);
    writeFileSync(path, JSON.stringify(first) + "\n");

    expect(() => new Journal(path)).toThrow(/corrupt/);
  });

  it("hashes the sequence, time, kind, data and previous hash", () => {
    const base = { seq: 1, ts: "2026-01-01T00:00:00.000Z", kind: "tick" as const, data: { n: 1 }, prev: "0".repeat(64) };
    const changed = hashEntry({ ...base, data: { n: 2 } });
    expect(changed).not.toBe(hashEntry(base));
  });
});
