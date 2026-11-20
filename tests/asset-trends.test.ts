import { test } from "node:test";
import assert from "node:assert/strict";
import { seedState } from "../lib/domain";
import { assetTrend, categoryTrend, filterTrend } from "../lib/asset-trends";
test("uses only detailed snapshot values, preserves zero and carry state", () => {
  const s = seedState(),
    id = s.assets[0].id;
  s.snapshots = [
    { date: "2026-09-01", values: { [id]: 100 }, confirmed: [id], debt: 0 },
    { date: "2026-10-01", values: { other: 50 }, confirmed: [], debt: 0 },
    { date: "2026-11-01", values: { [id]: 0 }, confirmed: [], debt: 0 },
  ];
  assert.deepEqual(assetTrend(s, id), [
    { date: "2026-09-01", value: 100, confirmed: true },
    { date: "2026-11-01", value: 0, confirmed: false },
  ]);
  assert.deepEqual(assetTrend(s, "missing"), []);
});
test("filters actual calendar months without excluding cutoff day", () => {
  const p = [
    { date: "2026-08-31", value: 1, confirmed: true },
    { date: "2026-09-01", value: 2, confirmed: true },
    { date: "2026-11-30", value: 3, confirmed: false },
  ];
  assert.equal(filterTrend(p, "3개월").length, 3);
  assert.equal(filterTrend(p, "전체").length, 3);
  assert.equal(filterTrend([], "전체").length, 0);
});
test("category sums snapshot membership under current classification", () => {
  const s = seedState();
  const ids = s.assets.filter((a) => a.category === "현금").map((a) => a.id);
  s.snapshots = [
    {
      date: "2026-11-01",
      values: { [ids[0]]: 100, [ids[1]]: 20 },
      confirmed: [ids[0]],
      debt: 0,
    },
  ];
  assert.deepEqual(categoryTrend(s, "현금"), [
    { date: "2026-11-01", value: 120, confirmed: false },
  ]);
  assert.deepEqual(categoryTrend(s, "없음"), []);
});
