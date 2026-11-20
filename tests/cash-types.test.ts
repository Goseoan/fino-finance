import { encodeDocument, decodeDocument } from "../lib/sheets-document";
import { mutateState } from "../lib/mutations";
import { test } from "node:test";
import assert from "node:assert/strict";
import { cashType, groupCashAssets } from "../lib/cash-types";
import { seedState, saveSnapshot } from "../lib/domain";
import { assetJournal } from "../lib/asset-journal";
test("cash subtypes are conservative suggestions with manual and custom overrides", () => {
  const a = { name: "입출금(예시은행)", category: "현금" };
  assert.equal(cashType(a), "입출금");
  assert.equal(cashType({ ...a, name: "CMA 계좌" }), "CMA·파킹");
  assert.equal(cashType({ ...a, name: "정기예금" }), "정기예금");
  assert.equal(cashType({ ...a, name: "출자금" }), "유형 검토 필요");
  assert.equal(cashType({ ...a, name: "알 수 없는 통장" }), "기타·미분류");
  assert.equal(cashType({ ...a, cashType: "비상자금" }), "비상자금");
  const s = seedState();
  const cash = s.assets.filter((a) => a.category === "현금");
  const before = structuredClone(cash);
  const grouped = groupCashAssets(cash);
  assert.equal(grouped.flatMap((g) => g.items).length, cash.length);
  assert.equal(
    grouped.reduce((sum, g) => sum + g.total, 0),
    cash.reduce((sum, a) => sum + (a.active ? a.value : 0), 0),
  );
  assert.deepEqual(cash, before);
});
test("same-date corrections retain before-after audit records while the date chart stores its final balance", () => {
  let s = seedState();
  const id = s.assets[0].id,
    original = s.assets[0].value,
    date = s.snapshots.at(-1)!.date;
  s = saveSnapshot(s, {
    date,
    changes: { [id]: original + 100 },
    revision: s.revision,
  });
  s = saveSnapshot(s, {
    date,
    changes: { [id]: original + 200 },
    revision: s.revision,
  });
  const journal = assetJournal(s, id);
  assert.equal(journal.length, 2);
  assert.equal(journal[0].beforeValue, original);
  assert.equal(journal[0].afterValue, original + 100);
  assert.equal(journal[1].beforeValue, original + 100);
  assert.equal(journal[1].afterValue, original + 200);
  assert.equal(s.snapshots.filter((p) => p.date === date).length, 1);
  assert.equal(s.snapshots.at(-1)!.values[id], original + 200);
  s.assets[0].cashType = "입출금";
  const stored = decodeDocument(
    encodeDocument(s, "synthetic-journal-test"),
  )!.state;
  assert.equal(stored.assets[0].cashType, "입출금");
  assert.equal(assetJournal(stored, id)[1].beforeValue, original + 100);
  assert.equal(assetJournal(stored, id)[1].afterValue, original + 200);
  let removed = mutateState(stored, {
    kind: "delete",
    entity: "asset",
    ids: [id],
    revision: stored.revision,
  });
  removed = mutateState(removed, {
    kind: "purgeTrash",
    id: removed.trash!.find((t) => t.entity === "asset")!.id,
    revision: removed.revision,
  });
  assert.equal(assetJournal(removed, id).length, 0);
});
