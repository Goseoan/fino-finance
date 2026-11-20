import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedOrigin } from "../lib/http";
test("origin check uses actual host and rejects cross site and missing origins", () => {
  assert.equal(
    allowedOrigin(
      new Headers({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }),
    ),
    true,
  );
  assert.equal(
    allowedOrigin(
      new Headers({ host: "127.0.0.1:3000", origin: "https://evil.example" }),
    ),
    false,
  );
  assert.equal(allowedOrigin(new Headers({ host: "127.0.0.1:3000" })), false);
  assert.equal(
    allowedOrigin(
      new Headers({ host: "evil.example", origin: "http://evil.example" }),
    ),
    false,
  );
});
test("private GET endpoints reject foreign hosts and userinfo hosts", async () => {
  const { allowedHost } = await import("../lib/http");
  assert.equal(allowedHost(new Headers({ host: "127.0.0.1:3000" })), true);
  assert.equal(allowedHost(new Headers({ host: "attacker.example" })), false);
  assert.equal(
    allowedHost(new Headers({ host: "evil@127.0.0.1:3000" })),
    false,
  );
});
