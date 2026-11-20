import { test, expect } from "@playwright/test";
import { seedState } from "../../lib/domain";
const origin = "http://127.0.0.1:3100";
test("classification preview apply undo preserves amounts and journals changes", async ({
  page,
  request,
}) => {
  const before = await (await request.get("/api/state")).json(),
    s = seedState();
  s.expenses = [
    { ...s.expenses[0], name: "합성 인터넷 요금", category: "생활비예산" },
  ];
  expect(
    (
      await request.post("/api/state", {
        headers: { Origin: origin },
        data: { kind: "restore", revision: before.revision, state: s },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/");
  await page.getByRole("button", { name: "고정지출", exact: true }).click();
  const panel = page.getByRole("region", { name: "현금흐름 분류 점검" });
  await expect(panel.getByText("정정 가능한 분류 1건")).toBeVisible();
  await panel.getByRole("checkbox").check();
  await panel.getByRole("button", { name: "선택한 1건 분류 정정" }).click();
  await expect(
    panel.getByRole("button", { name: "최근 분류 정비 되돌리기" }),
  ).toBeVisible();
  let saved = await (await request.get("/api/state")).json();
  expect(saved.expenses[0].category).toBe("소비지출");
  expect(saved.expenses[0].amount).toBe(s.expenses[0].amount);
  expect(
    saved.audit.some((a: any) => a.classification?.operation === "apply"),
  ).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "고정지출", exact: true }).click();
  await page.getByRole("button", { name: "최근 분류 정비 되돌리기" }).click();
  await expect(page.getByText("정정 가능한 분류 1건")).toBeVisible();
  saved = await (await request.get("/api/state")).json();
  expect(saved.expenses[0].category).toBe("생활비예산");
  expect(saved.expenses[0].amount).toBe(s.expenses[0].amount);
});
for (const width of [1440, 390])
  test(`unknown loan payment does not display principal as monthly payment ${width}`, async ({
    page,
  }) => {
    const s = seedState();
    s.loans = [
      {
        ...s.loans[0],
        method: "원리금균등",
        months: null,
        monthlyPrincipal: 100000,
      },
    ];
    await page.route("**/api/state", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: s })
        : route.continue(),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    if (width === 390)
      await page.getByRole("button", { name: "메뉴 열기" }).click();
    await page.getByRole("button", { name: "대출 관리", exact: true }).click();
    await expect(
      page.getByText("정보 확인 필요", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("잔여 기간 확인 필요", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("금리 시뮬레이션", { exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".sidebar-scrim")).toHaveCount(0);
    await page.screenshot({
      path: `test-results/unknown-loan-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
