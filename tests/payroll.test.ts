import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blankPayslip,
  payrollSchema,
  payrollMonthly,
  payrollSuggestions,
  payrollComparison,
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
  assert.deepEqual(
    {
      period: result.period,
      gross: result.gross,
      deducted: result.deducted,
      net: result.net,
    },
    {
      period: "2026-01",
      gross: 1000,
      deducted: 100,
      net: 900,
    },
  );
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

test("annual income and retirement references never enter monthly salary and comparisons preserve missing items", () => {
  const base = {
    ...blankPayslip(),
    status: "confirmed" as const,
    period: "2026-01",
    gross: 1000,
    deducted: 100,
    net: 900,
    earnings: [{ id: "e", label: "본봉", amount: 1000 }],
    deductions: [{ id: "d", label: "보험료", amount: 100 }],
  };
  const annual = payrollSchema.parse({
    ...blankPayslip(),
    kind: "연간소득",
    referenceYear: 2025,
    referenceValues: [{ id: "annual", label: "연간급여", amount: 12000 }],
    status: "confirmed",
  });
  const retired = payrollSchema.parse({
    ...blankPayslip(),
    kind: "퇴직금",
    referenceDate: "2026-01-31",
    referenceValues: [{ id: "rate", label: "지급률", amount: 20.5, unit: "" }],
    status: "confirmed",
  });
  assert.equal(payrollMonthly([base, annual, retired]).length, 1);
  assert.equal(payrollMonthly([base, annual, retired])[0].gross, 1000);
  const later = {
    ...base,
    id: "later",
    period: "2026-03",
    gross: 2000,
    net: 1900,
    earnings: [{ id: "extra", label: "상여", amount: 2000 }],
  };
  const compare = payrollComparison([base, later, annual]);
  assert.deepEqual(compare.periods, ["2026-01", "2026-03"]);
  assert.equal(
    compare.rows.find((r) => r.label === "본봉")!.values["2026-03"],
    undefined,
  );
  assert.throws(() =>
    payrollSchema.parse({
      ...annual,
      period: "2026-01",
      gross: 1000,
      net: 900,
      deducted: 100,
    }),
  );
  const proposal = payrollSuggestions([
    {
      text: "개인별퇴직금조회",
      x: 0,
      y: 0.9,
      width: 0.4,
      height: 0.03,
      confidence: 0.8,
    },
    {
      text: "3개월급여총액12345",
      x: 0,
      y: 0.5,
      width: 0.4,
      height: 0.03,
      confidence: 0.8,
    },
  ]);
  assert.equal(proposal.kind, "퇴직금");
  assert.equal(proposal.gross, null);
});
