import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blankPayslip,
  payrollSchema,
  payrollMonthly,
  payrollSuggestions,
} from "../lib/payroll";
test("payslips preserve zero and refunds; confirmation checks arithmetic and monthly sums exclude drafts and trash", () => {
  const base = {
    ...blankPayslip(),
    period: "2026-01",
    gross: 1000,
    deducted: -100,
    net: 1100,
    status: "confirmed" as const,
  };
  assert.equal(payrollSchema.parse(base).net, 1100);
  assert.throws(() => payrollSchema.parse({ ...base, net: 1000 }));
  assert.throws(() =>
    payrollSchema.parse({
      ...base,
      earnings: [{ id: "e", label: "기본급", amount: 0 }],
    }),
  );
  assert.deepEqual(
    payrollMonthly([
      base,
      { ...base, id: "bonus", net: 0, gross: 0, deducted: 0 },
      { ...base, id: "draft", status: "draft" },
      { ...base, id: "trash", deletedAt: "now" },
    ]),
    [{ period: "2026-01", gross: 1000, deducted: -100, net: 1100, count: 2 }],
  );
});
test("OCR suggests explicit totals only; unknown stays null and birth dates are not payroll months", () => {
  const line = (text: string, x = 0, y = 0.85) => ({
    text,
    x,
    y,
    width: 0.2,
    height: 0.02,
    confidence: 0.95,
  });
  const result = payrollSuggestions([
    line("2026년 1월 급여명세서"),
    line("지급총액", 0, 0.5),
    line("1,000", 0.3, 0.5),
    line("공제합계: 100", 0, 0.4),
    line("실수령액 900", 0, 0.3),
    line("1990년 2월", 0, 0.2),
  ]);
  assert.deepEqual(result, {
    period: "2026-01",
    gross: 1000,
    deducted: 100,
    net: 900,
  });
  assert.equal(payrollSuggestions([line("알 수 없는 자료")]).net, null);
});
test("OCR reads a numeric cell directly under an explicit total header but leaves ambiguous columns unknown", () => {
  const head = {
    text: "급여총액",
    x: 0.48,
    y: 0.65,
    width: 0.12,
    height: 0.02,
    confidence: 0.5,
  };
  const cell = {
    text: "1,000",
    x: 0.5,
    y: 0.615,
    width: 0.07,
    height: 0.02,
    confidence: 0.5,
  };
  assert.equal(payrollSuggestions([head, cell]).gross, 1000);
  assert.equal(
    payrollSuggestions([head, cell, { ...cell, x: 0.56, text: "2,000" }]).gross,
    null,
  );
});
