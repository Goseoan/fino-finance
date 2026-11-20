import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMoneyInput, moneyDigits, moneyCaret } from "../lib/money-input";
test("amount formatting preserves empty zero and exact integer digits", () => {
  assert.equal(formatMoneyInput(123456789), "123,456,789");
  assert.equal(formatMoneyInput(0), "0");
  assert.equal(formatMoneyInput(null), "");
  assert.equal(formatMoneyInput(NaN), "");
  assert.equal(moneyDigits("1,234,567"), "1234567");
  assert.equal(formatMoneyInput("9007199254740992"), "9,007,199,254,740,992");
  assert.equal(moneyCaret("12,345,678", 3), 4);
});
