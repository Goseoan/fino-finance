import { test } from "node:test";
import assert from "node:assert/strict";
import { withWriterLock } from "../lib/google-writer";
test("exclusive filesystem writer lock rejects a second writer and releases afterwards", async () => {
  const key = `test-${crypto.randomUUID()}`;
  await withWriterLock(key, async () => {
    await assert.rejects(
      () => withWriterLock(key, async () => {}),
      /쓰기 충돌/,
    );
  });
  await assert.doesNotReject(() => withWriterLock(key, async () => {}));
});
