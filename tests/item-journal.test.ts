import { test } from "node:test";
import assert from "node:assert/strict";
import { seedState } from "../lib/domain";
import { applyUpdate, mutateState } from "../lib/mutations";
import { itemJournal, journalMetric } from "../lib/item-journal";
import { encodeDocument, decodeDocument } from "../lib/sheets-document";
test("expense inline and form changes retain full before-after snapshots and normalize cycles for chart metrics", () => {
  let s = seedState();
  const id = s.expenses[0].id;
  const prior = s.expenses[0].amount;
  let desired = structuredClone(s);
  desired.expenses[0].amount = 240000;
  s = applyUpdate(s, { kind: "update", revision: s.revision, state: desired });
  desired = structuredClone(s);
  desired.expenses[0].amount = 2880000;
  desired.expenses[0].cycle = "연";
  desired.expenses[0].day = 12;
  desired.expenses[0].account = "예시 계좌";
  s = applyUpdate(s, { kind: "update", revision: s.revision, state: desired });
  const events = itemJournal(s, "expense", id);
  assert.equal(events.length, 2);
  assert.equal(events[0].before!.amount, prior);
  assert.equal(journalMetric(events[0], "amount", "after"), 240000);
  assert.equal(journalMetric(events[1], "monthly", "after"), 240000);
  assert.equal(events[1].before!.cycle, "월");
  assert.equal(events[1].after.cycle, "연");
  assert.equal(events[1].after.day, 12);
  const persisted = decodeDocument(
    encodeDocument(s, "synthetic-item-journal"),
  )!.state;
  assert.deepEqual(itemJournal(persisted, "expense", id), events);
  const recovered = structuredClone(persisted);
  for (const row of recovered.audit)
    if (row.itemChange?.entity === "expense")
      row.at =
        row.itemChange.after.cycle === "연"
          ? "2026-02-01T00:00:00Z"
          : "2026-01-01T00:00:00Z";
  recovered.audit.reverse();
  assert.equal(itemJournal(recovered, "expense", id).at(-1)!.after.cycle, "연");

  s = applyUpdate(s, { kind: "update", revision: s.revision, state: s });
  assert.equal(itemJournal(s, "expense", id).length, 2);
});
test("loan history tracks principal rate method and period; unknown payment inputs remain unknown", () => {
  let s = seedState();
  const id = s.loans[0].id;
  const desired = structuredClone(s);
  desired.loans[0].principal -= 10000;
  desired.loans[0].rate = 4.2;
  desired.loans[0].months = null;
  s = applyUpdate(s, { kind: "update", revision: s.revision, state: desired });
  const events = itemJournal(s, "loan", id);
  assert.equal(events.length, 1);
  assert.equal(events[0].before!.rate, 3.8);
  assert.equal(journalMetric(events[0], "rate", "after"), 4.2);
  assert.equal(journalMetric(events[0], "payment", "after"), null);
});
test("soft delete and restore keep item journals; permanent deletion removes current and archived references", () => {
  let s = seedState();
  const id = s.expenses[0].id;
  let desired = structuredClone(s);
  desired.expenses[0].amount += 100;
  s = applyUpdate(s, { kind: "update", revision: s.revision, state: desired });
  s = mutateState(s, {
    kind: "delete",
    entity: "expense",
    ids: [id],
    revision: s.revision,
  });
  assert.equal(itemJournal(s, "expense", id).at(-1)!.action, "삭제");
  const trashId = s.trash!.find((t) => t.entity === "expense")!.id;
  s = mutateState(s, {
    kind: "restoreTrash",
    id: trashId,
    revision: s.revision,
  });
  assert.equal(itemJournal(s, "expense", id).at(-1)!.action, "복원");
  s = mutateState(s, { kind: "clearAudit", revision: s.revision });
  s = mutateState(s, {
    kind: "delete",
    entity: "expense",
    ids: [id],
    revision: s.revision,
  });
  s = mutateState(s, {
    kind: "purgeTrash",
    id: s.trash!.find((t) => t.entity === "expense")!.id,
    revision: s.revision,
  });
  assert.equal(itemJournal(s, "expense", id).length, 0);
  assert.equal(
    JSON.stringify(s.trash).includes('"itemId":"' + id + '"'),
    false,
  );
});
