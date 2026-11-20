import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { writeFile, rm } from "node:fs/promises";
import path from "node:path";
const origin = "http://127.0.0.1:3100";
test.afterEach(async () => {
  await rm(path.join(process.cwd(), ".data", "e2e-google-connection.json"), {
    force: true,
  });
});
test("SQLite remains writable with unusable Google auth; Excel downloads complete state without credentials", async ({
  page,
  request,
}) => {
  await writeFile(
    path.join(process.cwd(), ".data", "e2e-google-connection.json"),
    JSON.stringify({
      clientId: "synthetic-client",
      clientSecret: "synthetic-private-secret",
      spreadsheetId: "synthetic-target",
      redirectUri: `${origin}/api/google/callback`,
      tokens: { refresh_token: "synthetic-invalid-token" },
      enabled: true,
    }),
    { mode: 0o600 },
  );
  const before = await (await request.get("/api/state")).json();
  expect(before.mode).toBe("demo");
  const next = structuredClone(before);
  next.settings.income = 123456;
  const save = await request.post("/api/state", {
    headers: { Origin: origin },
    data: {
      kind: "update",
      revision: before.revision,
      state: next,
      requestId: crypto.randomUUID(),
    },
  });
  expect(save.ok()).toBe(true);
  const saved = await save.json();
  expect(saved.settings.income).toBe(123456);
  const excel = await request.get("/api/export/excel");
  expect(excel.ok()).toBe(true);
  expect(excel.headers()["content-type"]).toContain("spreadsheetml");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Uint8Array.from(await excel.body()).buffer);
  expect(book.worksheets.length).toBe(8);
  expect(book.getWorksheet("자산")!.rowCount).toBe(saved.assets.length + 1);
  expect(book.getWorksheet("요약")!.getCell("B7").value).toBe(123456);
  for (const sheet of book.worksheets)
    sheet.eachRow((row) =>
      row.eachCell((cell) =>
        expect(String(cell.value ?? "")).not.toContain(
          "synthetic-private-secret",
        ),
      ),
    );
  await page.goto("/");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "저장 및 내보내기" }),
  ).toBeVisible();
  await expect(
    page.getByText("기본 저장소 · SQLite", { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "엑셀로 내보내기 (.xlsx)" }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.xlsx$/);
  const storage = await (await request.get("/api/storage")).json();
  expect(storage.provider).toBe("SQLite");
  expect(storage.lastTransfer).toBeNull();
  expect(
    (
      await request.post("/api/google/connect", {
        headers: { Origin: origin },
        data: { approved: true, source: "local" },
      })
    ).status(),
  ).toBe(409);
});
test("manual Google transfer requires preview and explicit approval; mobile settings fits screen", async ({
  page,
  request,
}) => {
  expect(
    (
      await request.post("/api/transfer/google", {
        headers: { Origin: "https://external.example" },
        data: { action: "push" },
      })
    ).status(),
  ).toBe(403);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Google 전송 미리보기" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "확인한 자료 Google로 전송" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".sidebar-scrim")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/sqlite-settings-mobile.png",
    animations: "disabled",
    fullPage: true,
  });
});
