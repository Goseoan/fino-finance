import { test } from "node:test";
import assert from "node:assert/strict";
import { seedState, cashflow } from "../lib/domain";
import {
  classificationPreview,
  applyClassification,
  undoClassification,
} from "../lib/expense-classification";
test("only clear recurring bills become consumption; budgets payroll and custom purposes survive", () => {
  const s = seedState();
  s.expenses = [
    {
      ...s.expenses[0],
      id: "bill",
      name: "인터넷 요금",
      category: "생활비예산",
    },
    {
      ...s.expenses[0],
      id: "budget",
      name: "통신 예산",
      category: "생활비예산",
    },
    {
      ...s.expenses[0],
      id: "custom",
      name: "인터넷 요금",
      category: "생활비예산",
      purpose: "직접 관리",
    },
    {
      ...s.expenses[0],
      id: "payroll",
      name: "통신 요금",
      category: "급여공제",
    },
  ];
  const preview = classificationPreview(s);
  assert.deepEqual(
    preview.map((x) => x.id),
    ["bill"],
  );
  const result = applyClassification(
    s,
    ["bill"],
    s.revision,
    "synthetic-batch",
  );
  assert.equal(result.expenses[0].category, "소비지출");
  assert.equal(cashflow(result).budget, cashflow(s).budget);
  assert.equal(result.expenses[0].amount, s.expenses[0].amount);
  assert.equal(result.expenses[0].purpose, s.expenses[0].purpose);
  assert.ok(
    result.audit.some(
      (a) =>
        a.itemChange?.itemId === "bill" &&
        a.classification?.batchId === "synthetic-batch",
    ),
  );
  const edited = structuredClone(result);
  edited.expenses[0].amount += 1;
  const undone = undoClassification(edited, "synthetic-batch", edited.revision);
  assert.equal(undone.expenses[0].category, "생활비예산");
  assert.equal(undone.expenses[0].amount, edited.expenses[0].amount);
  assert.throws(() =>
    undoClassification(undone, "synthetic-batch", undone.revision),
  );
  assert.throws(
    () => applyClassification(s, ["bill"], s.revision + 1, "stale"),
    /충돌/,
  );
});
test("undo refuses to overwrite a classification changed afterwards", () => {
  const s = seedState();
  s.expenses = [{ ...s.expenses[0], name: "관리비", category: "생활비예산" }];
  const next = applyClassification(s, [s.expenses[0].id], s.revision, "batch");
  next.expenses[0].category = "저축·투자";
  assert.throws(() => undoClassification(next, "batch", next.revision), /충돌/);
});
