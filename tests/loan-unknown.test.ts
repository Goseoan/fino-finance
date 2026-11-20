import { test } from "node:test";
import assert from "node:assert/strict";
import {
  seedState,
  loanMonthly,
  cashflow,
  scheduledOutflow,
} from "../lib/domain";
test("missing annuity period is unknown even with monthly principal, never a one-month payoff", () => {
  const s = seedState();
  const l = {
    ...s.loans[0],
    principal: 12000000,
    months: null,
    method: "원리금균등" as const,
    monthlyPrincipal: 100000,
    active: true,
  };
  s.loans = [l];
  s.expenses = [];
  assert.equal(loanMonthly(l), null);
  assert.equal(cashflow(s).loan, null);
  assert.equal(cashflow(s).remaining, null);
  assert.equal(cashflow(s).unknownLoans, 1);
  assert.equal(scheduledOutflow(s, "2026-11").unknownLoans, 1);
  assert.equal(loanMonthly({ ...l, method: "원금균등", rate: 12 }), 220000);
  assert.equal(loanMonthly({ ...l, method: "만기일시", rate: 12 }), 120000);
  assert.equal(loanMonthly({ ...l, active: false }), 0);
});
