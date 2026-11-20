import { test } from "node:test";
import assert from "node:assert/strict";
import { seedState } from "../lib/domain";
import {
  encodeDocument,
  decodeDocument,
  assertWriteTarget,
} from "../lib/sheets-document";
test("sheet document round trips chunks and validates revision signature", () => {
  const s = seedState();
  s.mode = "sheets";
  s.audit = [{ id: "a", at: "now", description: "한글".repeat(40000) }];
  const rows = encodeDocument(s, "req-1");
  assert.ok(rows.length > 2);
  assert.deepEqual(decodeDocument(rows)?.state, s);
  assert.equal(decodeDocument(rows)?.requestId, "req-1");
  assert.throws(() => decodeDocument([["other", 0]]));
  const broken = structuredClone(rows);
  broken[0][1] = 10;
  assert.throws(() => decodeDocument(broken));
  assert.equal(decodeDocument([]), null);
});
test("writes reject original spreadsheet and unexpected sheet name", () => {
  assert.throws(() =>
    assertWriteTarget(
      "protected-source-spreadsheet",
      "08_앱데이터",
    ),
  );
  assert.throws(() => assertWriteTarget("copy", "02_자산현황"));
  assert.doesNotThrow(() => assertWriteTarget("copy", "08_앱데이터"));
});
