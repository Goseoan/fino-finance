import { test } from "node:test";
import assert from "node:assert/strict";
import { migrateSource } from "../lib/migration";
test("preserves conflicting dates and rejects invalid totals", () => {
  const source = [
    {
      name: "02_자산현황",
      rows: [
        [],
        ["A1", "현금", "계좌", "통장", 1000, "", "", "", "", "2026-08-08"],
      ],
    },
    { name: "03_대출관리", rows: [[], ["L1", "대출", 300, 0.04, 0]] },
    {
      name: "01_월고정지출",
      rows: [
        [],
        ["F1", "보험", "보험", "소비지출", "연", 1200, "", 25, "통장", "활성"],
      ],
    },
    {
      name: "05_이력분석",
      rows: [
        [],
        ["20260808", "2026-08-08", "2026-04-15", 0, 0, 0, 0, 1000, 300, 700],
      ],
    },
  ];
  const s = migrateSource(source);
  assert.equal(s.mode, "imported");
  assert.equal(s.history[0].sourceDate, "2026-04-15");
  assert.equal(s.snapshots[0].confirmed.length, 0);
  assert.equal(s.assets[0].date, "2026-04-15");
  assert.throws(() => migrateSource([]), /자산/);
});
test("missing dates and payment day remain unknown", () => {
  const source = [
    {
      name: "02_자산현황",
      rows: [
        [],
        ["A1", "현금", "계좌", "통장", 1000, "", "", "", "", "2026-08-08"],
      ],
    },
    { name: "03_대출관리", rows: [[], ["L1", "대출", 300, 0.04, 0]] },
    {
      name: "01_월고정지출",
      rows: [
        [],
        ["F1", "보험", "보험", "소비지출", "연", 1200, "", "", "통장", "활성"],
      ],
    },
    {
      name: "05_이력분석",
      rows: [
        [],
        ["20260808", "2026-08-08", "2026-04-15", 0, 0, 0, 0, 1000, 300, 700],
      ],
    },
  ];
  const s = migrateSource(source);
  assert.equal(s.expenses[0].day, null);
  assert.equal(s.loans[0].maturity, null);
  assert.equal(s.loans[0].months, null);
});
