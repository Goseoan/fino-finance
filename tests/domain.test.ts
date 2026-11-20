import { test } from "node:test";
import assert from "node:assert/strict";
import {
  monthlyEquivalent,
  payment,
  cashflow,
  saveSnapshot,
  seedState,
  stateSchema,
} from "../lib/domain";
test("annual and quarterly costs are monthly budgets", () => {
  assert.equal(monthlyEquivalent(120000, "연"), 10000);
  assert.equal(monthlyEquivalent(30000, "분기"), 10000);
});
test("zero interest payment and interest-only calculation", () => {
  assert.equal(payment(120000, 0, 12, "원리금균등"), 10000);
  assert.equal(payment(120000, 12, 12, "만기일시"), 1200);
});
test("payroll deductions and paused expenses are not cash outflow", () => {
  const s = seedState();
  s.expenses = [
    {
      id: "e",
      name: "공제",
      category: "급여공제",
      amount: 10000,
      cycle: "월",
      day: 1,
      account: "급여",
      active: true,
    },
    {
      id: "e2",
      name: "보험",
      category: "소비지출",
      amount: 120000,
      cycle: "연",
      day: 1,
      account: "은행",
      active: true,
    },
  ];
  s.loans = [];
  assert.equal(cashflow(s).budget, 10000);
});
test("date upsert is unique and unchanged assets remain carried", () => {
  const s = seedState();
  const a = s.assets[0];
  const next = saveSnapshot(s, {
    date: "2026-11-20",
    changes: { [a.id]: 12345 },
    revision: 0,
  });
  assert.equal(next.snapshots.filter((x) => x.date === "2026-11-20").length, 1);
  assert.equal(next.snapshots.at(-1)?.confirmed.length, 1);
  const again = saveSnapshot(next, {
    date: "2026-11-20",
    changes: { [a.id]: 12345 },
    revision: 1,
  });
  assert.equal(again.snapshots.length, next.snapshots.length);
  assert.equal(again.audit.length, next.audit.length);
});
test("invalid date amount and stale revision are rejected", () => {
  const s = seedState();
  assert.throws(() =>
    saveSnapshot(s, { date: "2026-02-30", changes: {}, revision: 0 }),
  );
  assert.throws(() =>
    saveSnapshot(s, {
      date: "2026-11-20",
      changes: { [s.assets[0].id]: -1 },
      revision: 0,
    }),
  );
  assert.throws(
    () => saveSnapshot(s, { date: "2026-11-20", changes: {}, revision: 9 }),
    /충돌/,
  );
  assert.equal(
    stateSchema.safeParse({ ...s, assets: [{ ...s.assets[0], value: NaN }] })
      .success,
    false,
  );
});
test("inactive assets are excluded from new snapshot membership", () => {
  const s = seedState();
  s.assets[0].active = false;
  const next = saveSnapshot(s, {
    date: "2026-11-20",
    changes: { [s.assets[1].id]: 123 },
    revision: 0,
  });
  assert.equal(s.assets[0].id in next.snapshots.at(-1)!.values, false);
});
test("snapshot before earliest known date is rejected", () => {
  const s = seedState();
  assert.throws(
    () =>
      saveSnapshot(s, {
        date: "2025-01-01",
        changes: { [s.assets[0].id]: 1 },
        revision: 0,
      }),
    /이전/,
  );
});
test("restore rejects duplicate ids dates and unknown references", () => {
  const s = seedState();
  assert.equal(
    stateSchema.safeParse({ ...s, assets: [...s.assets, s.assets[0]] }).success,
    false,
  );
  assert.equal(
    stateSchema.safeParse({ ...s, snapshots: [...s.snapshots, s.snapshots[0]] })
      .success,
    false,
  );
  assert.equal(
    stateSchema.safeParse({
      ...s,
      snapshots: [{ ...s.snapshots[0], values: { unknown: 1 } }],
    }).success,
    false,
  );
});
test("asset edit survives next snapshot", async () => {
  const { applyAssetEdits } = await import("../lib/domain");
  const s = seedState();
  const assets = s.assets.map((a, i) => (i === 0 ? { ...a, value: 999 } : a));
  const edited = applyAssetEdits(s, assets);
  const next = saveSnapshot(edited, {
    date: "2026-11-20",
    changes: { [assets[1].id]: 123 },
    revision: edited.revision,
  });
  assert.equal(next.assets[0].value, 999);
});
test("timeline merges snapshots for previous comparison", async () => {
  const { timeline } = await import("../lib/domain");
  const s = seedState();
  const first = saveSnapshot(s, {
    date: "2026-11-20",
    changes: { [s.assets[0].id]: 123 },
    revision: 0,
  });
  const second = saveSnapshot(first, {
    date: "2026-11-21",
    changes: { [s.assets[0].id]: 456 },
    revision: 1,
  });
  assert.equal(timeline(second).at(-2)?.date, "2026-11-20");
});
test("annual payment month uses full payment while budget stays monthly", async () => {
  const { scheduledOutflow } = await import("../lib/domain");
  const s = seedState();
  s.loans = [];
  s.expenses = [
    {
      id: "annual",
      name: "보험",
      category: "소비지출",
      amount: 120000,
      cycle: "연",
      day: null,
      account: "통장",
      active: true,
      dueDate: "2026-12-15",
    },
  ];
  assert.equal(cashflow(s).budget, 10000);
  assert.equal(scheduledOutflow(s, "2026-11").scheduled, 0);
  assert.equal(scheduledOutflow(s, "2026-12").scheduled, 120000);
  assert.equal(scheduledOutflow(s, "2027-12").scheduled, 120000);
});
test("amortization separates principal interest and never negative balance", async () => {
  const { amortization } = await import("../lib/domain");
  const l = { ...seedState().loans[0], principal: 120000, rate: 0, months: 12 };
  const rows = amortization(l);
  assert.equal(rows.length, 12);
  assert.equal(rows[0].principal, 10000);
  assert.equal(rows.at(-1)?.balance, 0);
  assert.equal(rows[0].interest, 0);
});
test("backdated correction propagates only through unconfirmed carry", async () => {
  const { applyAssetEdits } = await import("../lib/domain");
  const s = seedState();
  const first = saveSnapshot(s, {
    date: "2026-11-20",
    changes: { [s.assets[1].id]: 123 },
    revision: 0,
  });
  const edited = applyAssetEdits(
    first,
    first.assets.map((a, i) => (i === 0 ? { ...a, value: 999 } : a)),
  );
  assert.equal(edited.assets[0].value, 999);
  assert.equal(edited.snapshots.at(-1)?.values[s.assets[0].id], 999);
});
test("historical asset correction preserves historical debt", () => {
  const s = seedState();
  const first = saveSnapshot(s, {
    date: "2026-11-20",
    changes: { [s.assets[1].id]: 123 },
    revision: 0,
  });
  first.loans[0].principal = 300;
  const edited = saveSnapshot(first, {
    date: "2026-11-18",
    changes: { [s.assets[0].id]: 999 },
    revision: 1,
  });
  assert.equal(edited.snapshots[0].debt, 420000000);
});
test("same date resave reflects dated debt change", () => {
  const s = seedState();
  s.loans[0].principal = 300;
  const next = saveSnapshot(s, {
    date: "2026-11-18",
    changes: {},
    revision: 0,
  });
  assert.equal(next.snapshots[0].debt, 300);
});
test("asset status changes append a current snapshot and preserve old measurements", async () => {
  const { applyAssetEdits } = await import("../lib/domain");
  const s = seedState(),
    id = s.assets[0].id;
  const inactive = applyAssetEdits(
    s,
    s.assets.map((a) => (a.id === id ? { ...a, active: false } : a)),
  );
  assert.equal(inactive.snapshots[0].values[id], s.assets[0].value);
  assert.equal(inactive.snapshots.at(-1)?.values[id], undefined);
  const active = applyAssetEdits(
    inactive,
    inactive.assets.map((a) => (a.id === id ? { ...a, active: true } : a)),
  );
  assert.equal(active.assets[0].date, s.assets[0].date);
  assert.equal(active.snapshots.at(-1)?.confirmed.includes(id), false);
});
