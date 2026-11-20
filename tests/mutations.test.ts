import { test } from "node:test";
import assert from "node:assert/strict";
import { seedState, stateSchema } from "../lib/domain";
import { mutateState } from "../lib/mutations";
test("asset delete keeps historical references and can restore", () => {
  const s = seedState(),
    id = s.assets[0].id;
  const d = mutateState(s, {
    kind: "delete",
    entity: "asset",
    ids: [id],
    revision: 0,
  });
  assert.equal(d.assets[0].active, false);
  assert.ok(d.assets[0].deletedAt);
  assert.equal(d.snapshots[0].values[id], s.assets[0].value);
  assert.equal(d.snapshots.at(-1)?.values[id], undefined);
  assert.equal(d.trash?.length, 1);
  const r = mutateState(d, {
    kind: "restoreTrash",
    id: d.trash![0].id,
    revision: d.revision,
  });
  assert.equal(r.assets[0].active, true);
  assert.equal(r.assets[0].deletedAt, undefined);
  assert.equal(stateSchema.safeParse(r).success, true);
});
test("expense and loan delete retain recoverable contents", () => {
  for (const entity of ["expense", "loan"] as const) {
    const s = seedState();
    const list = entity === "expense" ? s.expenses : s.loans;
    const next = mutateState(s, {
      kind: "delete",
      entity,
      ids: [list[0].id],
      revision: 0,
    });
    assert.equal(
      (entity === "expense" ? next.expenses : next.loans)[0].active,
      false,
    );
    assert.equal(next.trash?.length, 1);
  }
});
test("record deletion removes both snapshot and matching aggregate", () => {
  const s = seedState();
  const d = mutateState(s, {
    kind: "delete",
    entity: "record",
    ids: ["2026-11-18"],
    revision: 0,
  });
  assert.equal(d.snapshots.length, 0);
  assert.equal(
    d.history.some((h) => h.date === "2026-11-18"),
    false,
  );
  const r = mutateState(d, {
    kind: "restoreTrash",
    id: d.trash![0].id,
    revision: d.revision,
  });
  assert.equal(r.snapshots.length, 1);
});
test("purge removes dangling asset refs; stale deletion and invalid IDs reject", () => {
  const s = seedState();
  assert.throws(() =>
    mutateState(s, {
      kind: "delete",
      entity: "asset",
      ids: ["missing"],
      revision: 0,
    }),
  );
  assert.throws(
    () =>
      mutateState(s, {
        kind: "delete",
        entity: "asset",
        ids: [s.assets[0].id],
        revision: 10,
      }),
    /충돌/,
  );
  const d = mutateState(s, {
    kind: "delete",
    entity: "asset",
    ids: [s.assets[0].id],
    revision: 0,
  });
  const p = mutateState(d, {
    kind: "purgeTrash",
    id: d.trash![0].id,
    revision: d.revision,
  });
  assert.equal(
    p.assets.some((a) => a.id === s.assets[0].id),
    false,
  );
  assert.equal(stateSchema.safeParse(p).success, true);
});
test("full clear and restore preserve the previous trash", () => {
  const s = seedState();
  const deleted = mutateState(s, {
    kind: "delete",
    entity: "expense",
    ids: [s.expenses[0].id],
    revision: 0,
  });
  const oldTrash = deleted.trash![0].id;
  const cleared = mutateState(deleted, {
    kind: "clearAll",
    revision: deleted.revision,
  });
  const restored = mutateState(cleared, {
    kind: "restoreTrash",
    id: cleared.trash![0].id,
    revision: cleared.revision,
  });
  assert.ok(restored.trash?.some((t) => t.id === oldTrash));
  const expense = mutateState(restored, {
    kind: "restoreTrash",
    id: oldTrash,
    revision: restored.revision,
  });
  assert.equal(expense.expenses[0].active, true);
});
test("record trash is restorable after a referenced asset is purged", () => {
  const s = seedState(),
    id = s.assets[0].id;
  const d = mutateState(s, {
    kind: "delete",
    entity: "record",
    ids: ["2026-11-18"],
    revision: 0,
  });
  const record = d.trash![0].id;
  const a = mutateState(d, {
    kind: "delete",
    entity: "asset",
    ids: [id],
    revision: d.revision,
  });
  const p = mutateState(a, {
    kind: "purgeTrash",
    id: a.trash![0].id,
    revision: a.revision,
  });
  const r = mutateState(p, {
    kind: "restoreTrash",
    id: record,
    revision: p.revision,
  });
  assert.equal(stateSchema.safeParse(r).success, true);
  assert.ok(r.snapshots.every((s) => !Object.hasOwn(s.values, id)));
});
test("restoring an asset does not falsely confirm its old balance today", () => {
  const s = seedState(),
    id = s.assets[0].id;
  const d = mutateState(s, {
    kind: "delete",
    entity: "asset",
    ids: [id],
    revision: 0,
  });
  const r = mutateState(d, {
    kind: "restoreTrash",
    id: d.trash![0].id,
    revision: d.revision,
  });
  assert.equal(r.assets[0].date, s.assets[0].date);
  assert.equal(r.snapshots.at(-1)?.confirmed.includes(id), false);
});
test('full clear also removes income and custom financial settings',()=>{const s=seedState();s.settings.assetCategories=['나의 분류'];const d=mutateState(s,{kind:'clearAll',revision:0});assert.equal(d.settings.income,0);assert.equal(d.settings.annualIncome,0);assert.equal(d.settings.assetCategories,undefined)});
