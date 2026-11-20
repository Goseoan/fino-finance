import { test, expect } from "@playwright/test";
test("API rejects external origins, invalid amount, and stale revisions", async ({
  request,
}) => {
  const s = await (await request.get("/api/state")).json();
  expect(
    (
      await request.post("/api/state", {
        headers: { Origin: "https://other.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  const body = {
    kind: "snapshot",
    date: "2026-11-20",
    revision: s.revision,
    changes: { [s.assets[0].id]: -1 },
  };
  expect(
    (
      await request.post("/api/state", {
        headers: { Origin: "http://127.0.0.1:3100" },
        data: body,
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/state", {
        headers: { Origin: "http://127.0.0.1:3100" },
        data: { ...body, revision: s.revision + 99, changes: {} },
      })
    ).status(),
  ).toBe(409);
});
test("unconfigured private import has no bundled personal data", async ({request}) => {
  expect((await request.get("/api/imported")).status()).toBe(503);
});
