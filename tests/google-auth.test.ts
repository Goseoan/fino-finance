import { test } from "node:test";
import assert from "node:assert/strict";
import { configSchema, validOAuthState } from "../lib/google-connection";
test("OAuth requires local callback and protects original; state rejects missing and unicode", () => {
  assert.equal(validOAuthState("abc", "abc"), true);
  assert.equal(validOAuthState("abc", "def"), false);
  assert.equal(validOAuthState("abc", "가나나"), false);
  assert.equal(validOAuthState(undefined, null), false);
  assert.equal(
    configSchema.safeParse({
      clientId: "client-id",
      clientSecret: "secret-value",
      spreadsheetId: "copy-id",
      redirectUri: "https://evil.example/api/google/callback",
    }).success,
    false,
  );
  assert.equal(
    configSchema.safeParse({
      clientId: "client-id",
      clientSecret: "secret-value",
      spreadsheetId: "protected-source-spreadsheet",
      redirectUri: "http://127.0.0.1:3000/api/google/callback",
    }).success,
    false,
  );
});
