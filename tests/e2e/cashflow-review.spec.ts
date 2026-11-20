import { test, expect } from "@playwright/test";
import { seedState } from "../../lib/domain";
test("expense classification review is removed while existing classifications remain", async ({page,request}) => {
  const before=await (await request.get("/api/state")).json();
  await page.goto("/");
  await page.getByRole("button",{name:"고정지출",exact:true}).click();
  await expect(page.getByRole("region",{name:"현금흐름 분류 점검"})).toHaveCount(0);
  await expect(page.getByText("현금흐름 분류 기준과 점검",{exact:true})).toHaveCount(0);
  await expect(page.getByPlaceholder("지출 항목 검색")).toBeVisible();
  const after=await (await request.get("/api/state")).json();
  expect(after.expenses).toEqual(before.expenses);
  expect(after.audit).toEqual(before.audit);
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
