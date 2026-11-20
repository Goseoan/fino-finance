import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  SQLiteRepository,
  legacyState,
  emptyState,
} from "../lib/sqlite-repository";
import { seedState } from "../lib/domain";

test("SQLite preserves full histories, optional fields and survives reopening; rollback protects state", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "fino-sql-"));
  const file = path.join(dir, "test.sqlite"),
    s = seedState();
  const a = new SQLiteRepository(file, () => s);
  try {
    assert.deepEqual(await a.read(), s);
    const next = await a.update((x) => ({
      ...x,
      revision: x.revision + 1,
      settings: { ...x.settings, income: 0 },
    }));
    await assert.rejects(
      a.update(() => {
        throw Error("conflict");
      }),
    );
    assert.deepEqual(await a.read(), next);
    a.close();
    const b = new SQLiteRepository(file, () => {
      throw Error("must not seed");
    });
    assert.deepEqual(await b.read(), next);
    assert.equal(Object.values(b.integrity()!)[0], "ok");
    assert.equal(statSync(file).mode & 0o777, 0o600);
    b.recordTransfer("synthetic", next.revision, 2);
    assert.equal(b.lastTransfer()?.revision, next.revision);
    b.close();
  } finally {
    a.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("legacy migration chooses latest revision, rejects conflicts and never seeds demo for new users", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "fino-migrate-"));
  try {
    assert.equal(legacyState(dir).assets.length, 0);
    assert.equal(emptyState().mode, "local");
    const s = seedState();
    writeFileSync(path.join(dir, "actual.json"), JSON.stringify(s));
    writeFileSync(
      path.join(dir, "sqlite-migration-source.json"),
      JSON.stringify({ ...s, revision: s.revision + 1 }),
    );
    assert.equal(legacyState(dir).revision, s.revision + 1);
    writeFileSync(
      path.join(dir, "actual.json"),
      JSON.stringify({
        ...s,
        revision: s.revision + 1,
        settings: { ...s.settings, income: 0 },
      }),
    );
    assert.throws(() => legacyState(dir), /異|서로/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("multiple connections reject stale saves and SQL failures roll back state and projections", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "fino-multi-")),
    file = path.join(dir, "test.sqlite");
  const a = new SQLiteRepository(file, seedState),
    b = new SQLiteRepository(file, seedState);
  try {
    const initial = await a.read();
    await b.read();
    await a.update((s) => ({ ...s, revision: s.revision + 1 }));
    await assert.rejects(
      b.update((s) => {
        if (s.revision !== initial.revision) throw Error("conflict");
        return s;
      }),
    );
    const before = await a.read();
    await assert.rejects(
      a.update((s) => ({
        ...s,
        revision: s.revision + 1,
        audit: [
          ...s.audit,
          { id: "dup", at: s.updatedAt, description: "synthetic" },
          { id: "dup", at: s.updatedAt, description: "synthetic" },
        ],
      })),
    );
    assert.deepEqual(await b.read(), before);
    assert.equal(Object.values(a.integrity()!)[0], "ok");
  } finally {
    a.close();
    b.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
