import { test, expect } from "@playwright/test";
import { seedState } from "../../lib/domain";
for (const width of [1440, 390])
  for (const dark of [false, true])
    test(`item trends ${width} ${dark ? "dark" : "light"}`, async ({
      page,
    }) => {
      const state = seedState(),
        id = state.assets[0].id;
      const values = state.snapshots[0].values;
      state.assets[0].value = 1500000;
      state.assets.push({
        ...state.assets[0],
        id: "no-history",
        name: "기록 없는 자산",
      });
      state.snapshots = [
        {
          date: "2026-02-28",
          values: { ...values, [id]: 1000000 },
          confirmed: [id],
          debt: 420000000,
        },
        {
          date: "2026-08-31",
          values: { ...values, [id]: 1200000 },
          confirmed: [id],
          debt: 420000000,
        },
        {
          date: "2026-11-20",
          values: { ...values, [id]: 1500000 },
          confirmed: [],
          debt: 420000000,
        },
      ];
      await page.route("**/api/state", async (route) =>
        route.request().method() === "GET"
          ? route.fulfill({ json: state })
          : route.continue(),
      );
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "나의 자산, 한눈에" }),
      ).toBeVisible();
      if (dark)
        await page
          .getByRole("button", { name: "다크 모드", exact: true })
          .click();
      if (width === 390)
        await page.getByRole("button", { name: "메뉴 열기" }).click();
      await page
        .getByRole("button", { name: "자산 관리", exact: true })
        .click();
      await page
        .getByRole("button", { name: "생활비 통장 변경 추이", exact: true })
        .click();
      const dialog = page.getByRole("dialog", { name: "자산 변경 추이" });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(".item-trend-record")).toHaveCount(3);
      await expect(
        dialog.getByText("이월값 · 미확인", { exact: true }).first(),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "3개월", exact: true }).click();
      await expect(dialog.locator(".item-trend-record")).toHaveCount(2);
      await expect(dialog.getByText("+300,000원 (+25.0%)")).toBeVisible();
      await dialog.getByLabel("추이 항목 선택").selectOption("category:현금");
      await expect(
        dialog.getByText("현금 합계 · 마지막 기록 2026-11-20"),
      ).toBeVisible();
      await dialog.getByLabel("추이 항목 선택").selectOption(`asset:${id}`);
      await dialog.getByRole("button", { name: "전체", exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        dialog.getByRole("heading", { name: "자산 변경 추이", exact: true }),
      ).toBeInViewport();
      await expect(
        dialog.getByRole("button", { name: "닫기", exact: true }),
      ).toBeInViewport();
      await page.screenshot({
        path: `.data/visual-review/item-trend-${width}-${dark ? "dark" : "light"}.png`,
        fullPage: false,
        animations: "disabled",
      });
      await dialog
        .getByLabel("추이 항목 선택")
        .selectOption("asset:no-history");
      await expect(dialog.getByText("아직 상세 기록이 없어요")).toBeVisible();
      await dialog.getByRole("button", { name: "닫기", exact: true }).click();
      if (width === 390)
        await page.getByRole("button", { name: "메뉴 열기" }).click();
      await page
        .getByRole("button", { name: "이력 및 통계", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "항목별 변경 추이", exact: true }),
      ).toBeVisible();
    });
