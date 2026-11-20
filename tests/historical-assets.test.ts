import { test } from "node:test";
import assert from "node:assert/strict";
import { seedState, totals } from "../lib/domain";
import {
  parseHistoricalAssets,
  mergeHistoricalAssets,
} from "../lib/historical-assets";
import { assetTrend } from "../lib/asset-trends";
import { mutateState } from "../lib/mutations";
test("dated detail tables map exact names, preserve zero and reject duplicate or ambiguous matches", () => {
  const s = seedState();
  s.assets[0].name = "입출금(예시은행)";
  s.assets[1].name = "정기 적금";
  const parsed = parseHistoricalAssets(
    [
      {
        name: "20250101",
        rows: [
          ["기준일", "2024-12-30"],
          ["대구분", "중구분", "소구분", "현저축액"],
          ["현금", "입출금", "예시은행", 0],
          ["현금", "정기 적금", "", 200],
          ["현금", "불명확", "", 300],
          [],
        ],
      },
      {
        name: "20250102",
        rows: [
          ["대구분", "중구분", "소구분", "현저축액"],
          ["현금", "정기 적금", "", 100],
          ["현금", "정기 적금", "", 200],
        ],
      },
      { name: "20250103", rows: [["총액만 있음"]] },
    ],
    s.assets,
  );
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].values[s.assets[0].id], 0);
  assert.equal(parsed.records[0].sourceDate, "2024-12-30");
  assert.equal(parsed.unmatched, 1);
  assert.equal(parsed.ambiguous, 2);
  assert.equal(parsed.skippedTabs, 2);
});
test("import merges only missing detail and never changes current balances classification snapshots or net totals", () => {
  const s = seedState(),
    id = s.assets[0].id,
    latest = s.snapshots.at(-1)!;
  const result = mergeHistoricalAssets(s, [
    { date: "2025-01-01", sourceDate: "2024-12-30", values: { [id]: 100 } },
    { date: latest.date, values: { [id]: 999 } },
  ]);
  assert.equal(result.addedValues, 1);
  assert.equal(result.conflicts, 1);
  assert.deepEqual(result.state.assets, s.assets);
  assert.deepEqual(result.state.snapshots, s.snapshots);
  assert.deepEqual(result.state.history, s.history);
  assert.deepEqual(totals(result.state), totals(s));
  assert.equal(assetTrend(result.state, id)[0].value, 100);
  assert.equal(assetTrend(result.state, id)[0].imported, true);
  assert.equal(assetTrend(result.state, id).at(-1)!.value, latest.values[id]);
  assert.equal(
    mergeHistoricalAssets(result.state, [
      { date: "2025-01-01", values: { [id]: 200 } },
    ]).addedValues,
    0,
  );
});
test("imported records support deletion restore full clear and asset purging", () => {
  let s = seedState();
  const id = s.assets[0].id;
  s = mergeHistoricalAssets(s, [
    { date: "2025-01-01", values: { [id]: 0 } },
  ]).state;
  const deleted = mutateState(s, {
    kind: "delete",
    entity: "record",
    ids: ["2025-01-01"],
    revision: s.revision,
  });
  assert.equal(deleted.assetHistory?.length, 0);
  assert.equal(
    mergeHistoricalAssets(deleted, [
      { date: "2025-01-01", values: { [id]: 50 } },
    ]).addedValues,
    0,
  );
  const restored = mutateState(deleted, {
    kind: "restoreTrash",
    id: deleted.trash!.find((t) => t.entity === "record")!.id,
    revision: deleted.revision,
  });
  assert.equal(restored.assetHistory?.[0].values[id], 0);
  const cleared = mutateState(s, { kind: "clearAll", revision: s.revision });
  assert.equal(cleared.assetHistory?.length, 0);
  let purged = mutateState(s, {
    kind: "delete",
    entity: "asset",
    ids: [id],
    revision: s.revision,
  });
  purged = mutateState(purged, {
    kind: "purgeTrash",
    id: purged.trash!.find((t) => t.entity === "asset")!.id,
    revision: purged.revision,
  });
  assert.equal(Object.hasOwn(purged.assetHistory![0].values, id), false);
});
