import { test, expect } from "@playwright/test";
test("snapshot preview, persisted save and navigation", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "나의 자산, 한눈에" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "오늘의 자산 등록", exact: true })
    .first()
    .click();
  const input = page.getByLabel("생활비 통장 평가액");
  const next = Number((await input.inputValue()).replace(/,/g, "")) + 220000;
  const formatted = new Intl.NumberFormat("ko-KR").format(next);
  await input.fill(String(next));
  await page.getByRole("button", { name: "변경사항 확인" }).click();
  await expect(page.getByRole("dialog")).toContainText(formatted);
  await page.getByRole("button", { name: "기록 저장", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("저장");
  await page.reload();
  await page.getByRole("button", { name: "자산 관리", exact: true }).click();
  await expect(page.getByText(formatted).first()).toBeVisible();
});
test("expenses filters and loan simulation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "고정지출", exact: true }).click();
  await page.getByPlaceholder("지출 항목 검색").fill("넷플릭스");
  await expect(
    page.locator(".desktop-table").getByText("넷플릭스", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("통신 요금", { exact: true })).not.toBeVisible();
  await page.getByPlaceholder("지출 항목 검색").fill("");
  await page.screenshot({path:".data/visual-review/expense-separators-desktop.png",fullPage:true});
  await page.getByRole("button", { name: "대출 관리", exact: true }).click();
  await expect(
    page.getByText("금리 시뮬레이션", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("시뮬레이션 금리").fill("5");
  await expect(page.getByTestId("sim-payment")).toBeVisible();
});
for (const [w, h] of [
  [1440, 900],
  [1920, 1080],
  [1280, 800],
  [390, 844],
])
  for (const theme of ["light", "dark"])
    test(`visual ${w} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "나의 자산, 한눈에" }),
      ).toBeVisible();
      if (theme === "dark")
        await page.getByRole("button", { name: "다크 모드" }).click();
      await page.waitForTimeout(800);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/dashboard-${w}-${theme}.png`,
        fullPage: true,
        animations: "disabled",
      });
    });
test("expense creation and inline amount save", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "고정지출", exact: true }).click();
  await page.getByRole("button", { name: "지출 추가", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("지출 항목", { exact: true }).fill(`테스트 보험`);
  await dialog.getByLabel("회당 납부액 (원)").fill("120000");
  await dialog.getByLabel("납부주기").selectOption("연");
  await page.getByRole("button", { name: "지출 저장" }).click();
  await expect(dialog).not.toBeVisible();
  const input = page
    .getByRole("textbox", { name: "테스트 보험 납부액" })
    .last();
  await input.fill("240000");
  await input.press("Tab");
  await expect(page.getByRole("status")).toContainText("저장");
  await page.reload();
  await page.getByRole("button", { name: "고정지출", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "테스트 보험 납부액" }).last(),
  ).toHaveValue("240,000");
});
test("failed save preserves draft and retry succeeds", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "오늘의 자산 등록", exact: true })
    .click();
  const input = page.getByLabel("생활비 통장 평가액");
  const value = String(
    Number((await input.inputValue()).replace(/,/g, "")) + 1000,
  );
  await input.fill(value);
  await page.route("**/api/state", async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "테스트 저장 실패. 다시 시도하세요." }),
      });
    else await route.continue();
  });
  await page.getByRole("button", { name: "변경사항 확인" }).click();
  await page.getByRole("button", { name: "기록 저장", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "테스트 저장 실패" }),
  ).toBeVisible();
  await expect(input).toHaveValue(Number(value).toLocaleString("en-US"));
  await page.unroute("**/api/state");
  await page.getByRole("button", { name: "변경사항 확인" }).click();
  await page.getByRole("button", { name: "기록 저장", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("저장");
});
for (const [w, h] of [
  [1440, 900],
  [1920, 1080],
  [1280, 800],
  [390, 844],
])
  for (const theme of ["light", "dark"])
    test(`entry visual ${w} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "나의 자산, 한눈에" }),
      ).toBeVisible();
      if (theme === "dark")
        await page.getByRole("button", { name: "다크 모드" }).click();
      if (w < 761)
        await page.getByRole("button", { name: "메뉴 열기" }).click();
      await page
        .getByRole("button", { name: "오늘의 자산 등록", exact: true })
        .click();
      await expect(page.getByLabel("생활비 통장 평가액")).toBeVisible();
      await page.waitForTimeout(250);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/entry-${w}-${theme}.png`,
        fullPage: true,
        animations: "disabled",
      });
    });
test("loan edit persists interest and completed status", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "대출 관리", exact: true }).click();
  await page
    .getByRole("button", { name: "주택담보대출 수정", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("연 금리 (%)", { exact: true }).fill("4.1");
  await page.getByRole("button", { name: "대출 저장", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("연 4.10%", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "대출 관리", exact: true }).click();
  await expect(page.getByText("연 4.10%", { exact: true })).toBeVisible();
});
test("category management persists new category", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const name = `검증분류${Date.now()}`;
  await page.getByLabel("새 자산 카테고리").fill(name);
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `${name} 카테고리 삭제` }).click();
  await expect(page.getByText(name, { exact: true })).not.toBeVisible();
});
test("all additional mobile screens fit viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "나의 자산, 한눈에" }),
  ).toBeVisible();
  for (const name of [
    "자산 관리",
    "고정지출",
    "대출 관리",
    "이력 및 통계",
    "설정",
  ]) {
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    await page.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(250);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/mobile-${name}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
});
