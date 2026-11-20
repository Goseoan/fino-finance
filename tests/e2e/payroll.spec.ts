import { test, expect } from "@playwright/test";
import { blankPayslip } from "../../lib/payroll";
import ExcelJS from "exceljs";
const origin = "http://127.0.0.1:3100";
const empty = {
  format: "FINO_PAYROLL_BACKUP_V1",
  records: [],
  audit: [],
  images: [],
};
async function reset(request: any) {
  const current = await (await request.get("/api/payroll")).json();
  expect(
    (
      await request.post("/api/payroll/backup", {
        headers: { Origin: origin },
        data: { revision: current.revision, approved: true, archive: empty },
      })
    ).ok(),
  ).toBe(true);
}
test.beforeEach(async ({ request }) => reset(request));
test.afterEach(async ({ request }) => reset(request));
test("photo payslip persists confirmed amounts, audit, Excel, trash and complete photo backup", async ({
  page,
  request,
}) => {
  const core = await (await request.get("/api/state")).json();
  await page.goto("/");
  await page.getByRole("button", { name: "급여명세서", exact: true }).click();
  await page.getByRole("button", { name: "명세서 등록", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("명세서 이름", { exact: true })
    .fill("합성 테스트 급여");
  await dialog.getByLabel("급여 귀속월").fill("2026-01");
  await dialog.getByLabel("명세서 사진", { exact: true }).setInputFiles({
    name: "synthetic.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBz0AAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await dialog.getByLabel("급여 지급액 합계").fill("1000000");
  await expect(dialog.getByLabel("급여 지급액 합계")).toHaveValue("1,000,000");
  await dialog.getByLabel("급여 공제액 합계").fill("100000");
  await dialog.getByLabel("급여 실수령액", { exact: true }).fill("900000");
  await dialog.getByLabel("급여 확인 상태").selectOption("confirmed");
  await dialog
    .getByRole("button", { name: "명세서 저장", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "급여명세서", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "2026-01", exact: true }),
  ).toBeVisible();
  const s = await (await request.get("/api/payroll")).json();
  expect(s.records).toHaveLength(1);
  expect(s.audit).toHaveLength(1);
  expect(s.records[0].net).toBe(900000);
  expect(
    (
      await request.get(`/api/payroll/images/${s.records[0].imageIds[0]}`)
    ).headers()["content-type"],
  ).toBe("image/png");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    Uint8Array.from(await (await request.get("/api/payroll/excel")).body())
      .buffer,
  );
  expect(book.getWorksheet("급여명세서")!.getCell("J2").value).toBe(900000);
  const archive = await (await request.get("/api/payroll/backup")).json();
  expect(archive.images).toHaveLength(1);
  expect(archive.images[0].data.length).toBeGreaterThan(20);
  expect(await (await request.get("/api/state")).json()).toEqual(core);
  await page.getByRole("button", { name: "상세·수정", exact: true }).click();
  await page.getByLabel("급여 실수령액", { exact: true }).fill("800000");
  await page.getByRole("button", { name: "명세서 저장", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "일치하지",
  );
  await page.getByRole("button", { name: "닫기", exact: true }).last().click();
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "합성 테스트 급여 삭제", exact: true })
    .click();
  await expect(
    page.getByText("표시할 명세서가 없습니다.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("급여 상태").selectOption("trash");
  await page.getByRole("button", { name: "복원", exact: true }).click();
  await page.getByLabel("급여 상태").selectOption("active");
  await expect(
    page.getByRole("heading", { name: "2026-01", exact: true }),
  ).toBeVisible();
});
test("mobile payslip draft leaves unknown amounts blank and OCR suggestions require review", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page.getByRole("button", { name: "급여명세서", exact: true }).click();
  await expect(page.locator(".sidebar-scrim")).toHaveCount(0);
  await page.getByRole("button", { name: "명세서 등록", exact: true }).click();
  await expect(page.getByLabel("급여 지급액 합계")).toHaveValue("");
  await page.getByLabel("명세서 이름", { exact: true }).fill("합성 검토 대기");
  await page.route("**/api/payroll/ocr", (route) =>
    route.fulfill({
      json: {
        requiresReview: true,
        suggestions: { period: null, gross: 1200, deducted: null, net: null },
      },
    }),
  );
  await page.getByLabel("명세서 사진", { exact: true }).setInputFiles({
    name: "synthetic.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBz0AAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .getByRole("button", { name: "사진에서 지급·공제 내역 분석", exact: true })
    .click();
  await expect(page.getByLabel("급여 지급액 합계")).toHaveValue("1,200");
  await expect(page.getByLabel("급여 실수령액", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("급여 확인 상태")).toHaveValue("draft");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "제안값",
  );

  await page.getByRole("button", { name: "명세서 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("귀속월 확인 필요", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/payroll-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("structured payroll entries compare by month and annual references stay outside monthly totals", async ({
  page,
  request,
}) => {
  let state = await (await request.get("/api/payroll")).json();
  const make = (period: string, value: number) => ({
    ...blankPayslip(),
    period,
    gross: value,
    deducted: 100,
    net: value - 100,
    status: "confirmed" as const,
    earnings: [
      { id: crypto.randomUUID(), label: "본봉", amount: value, group: "보수" },
    ],
    deductions: [
      {
        id: crypto.randomUUID(),
        label: "보험료",
        amount: 100,
        group: "사회보험",
      },
    ],
  });
  const annual = {
    ...blankPayslip(),
    kind: "연간소득",
    referenceYear: 2025,
    referenceValues: [{ id: "annual", label: "연간 급여", amount: 99999 }],
    status: "confirmed",
  };
  for (const p of [make("2026-01", 1000), make("2026-03", 2000), annual]) {
    const body = new FormData();
    body.set("action", "save");
    body.set("record", JSON.stringify(p));
    body.set("revision", String(state.revision));
    const r = await request.post("/api/payroll", {
      headers: { Origin: origin },
      multipart: {
        action: "save",
        record: JSON.stringify(p),
        revision: String(state.revision),
      },
    });
    expect(r.ok()).toBe(true);
    state = await r.json();
  }
  await page.goto("/");
  await page.getByRole("button", { name: "급여명세서", exact: true }).click();
  const table = page.getByRole("region", { name: "지급 공제 항목 비교" });
  await expect(table.getByRole("rowheader", { name: /본봉/ })).toBeVisible();
  await expect(
    table.getByRole("cell", { name: "+1,000원", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("참고자료 · 월급 합계와 추이에서 제외"),
  ).toBeVisible();
  await expect(page.locator(".stat-row")).toContainText("분석 완료 월급");
  await expect(page.locator(".stat-row")).toContainText("2,800");
  await expect(page.locator(".stat-row")).not.toContainText("99,999");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/payroll-structured-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
