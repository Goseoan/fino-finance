import { test } from "node:test";
import assert from "node:assert/strict";
import { googleConnectionError } from "../lib/google-errors";

test("disabled Sheets API explains the required action without exposing provider data", () => {
  const message = googleConnectionError({ response: { status: 403, data: { error: {
    message: "private credential material", errors: [{ reason: "accessNotConfigured" }],
  } } } });
  assert.match(message, /Google Sheets API.*활성화/);
  assert.doesNotMatch(message, /private credential/);
});
test("unknown Google errors never echo credentials or provider messages", () => {
  assert.doesNotMatch(googleConnectionError(new Error("secret-token")), /secret-token/);
});
