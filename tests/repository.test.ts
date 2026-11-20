import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FileRepository } from "../lib/repository";
import { saveSnapshot } from "../lib/domain";
test("atomic persistence survives new repository and concurrent stale save is rejected", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fino-test-"));
  try {
    const repo = new FileRepository(path.join(dir, "state.json"));
    const s = await repo.read();
    const jobs = await Promise.allSettled([
      repo.update((v) =>
        saveSnapshot(v, {
          date: "2026-11-20",
          changes: { [s.assets[0].id]: 111 },
          revision: 0,
        }),
      ),
      repo.update((v) =>
        saveSnapshot(v, {
          date: "2026-11-20",
          changes: { [s.assets[0].id]: 222 },
          revision: 0,
        }),
      ),
    ]);
    assert.equal(jobs.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(
      (await new FileRepository(path.join(dir, "state.json")).read()).assets[0]
        .value,
      111,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
