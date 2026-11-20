import { test, expect } from "@playwright/test";
import { seedState } from "../../lib/domain";
import { unlink } from "node:fs/promises";
import path from "node:path";
const origin = "http://127.0.0.1:3100";
async function reset(request: any) {
  const s = await (await request.get("/api/state")).json();
  const r = await request.post("/api/state", {
    headers: { Origin: origin },
    data: {
      kind: "restore",
      revision: s.revision,
      state: seedState(),
      requestId: crypto.randomUUID(),
    },
  });
  expect(r.ok()).toBe(true);
}
test.beforeEach(async ({ request }) => {
  await unlink(
    path.join(process.cwd(), ".data", "e2e-google-connection.json"),
  ).catch(() => {});
  await reset(request);
});
test.afterEach(async ({ request }) => {
  await unlink(
    path.join(process.cwd(), ".data", "e2e-google-connection.json"),
  ).catch(() => {});
  await reset(request);
});
test("grid edits multiple balances and saves a single batch", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "자산 관리", exact: true }).click();
  await page.getByRole("button", { name: "그리드 보기", exact: true }).click();
  await page
    .getByLabel("생활비 통장 그리드 평가액", { exact: true })
    .fill("5000000");
  await page
    .getByLabel("모으기 통장 그리드 평가액", { exact: true })
    .fill("13000000");
  await expect(
    page.getByLabel("생활비 통장 그리드 평가액", { exact: true }),
  ).toHaveValue("5,000,000");
  await expect(page.getByText("2개 행 수정 중")).toBeVisible();
  await page.getByRole("button", { name: "일괄 저장", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("저장");
  await page.reload();
  await page.getByRole("button", { name: "자산 관리", exact: true }).click();
  await page.getByRole("button", { name: "그리드 보기", exact: true }).click();
  await expect(
    page.getByLabel("생활비 통장 그리드 평가액", { exact: true }),
  ).toHaveValue("5,000,000");
  await expect(
    page.getByLabel("모으기 통장 그리드 평가액", { exact: true }),
  ).toHaveValue("13,000,000");
  await page.screenshot({
    path: ".data/visual-review/asset-grid-desktop.png",
    fullPage: true,
  });
});
test("asset deletion confirmation, trash restore and permanent deletion", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "자산 관리", exact: true }).click();
  await page
    .getByRole("button", { name: "생활비 통장 자산 삭제", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("과거 기록");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "생활비 통장", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "생활비 통장 자산 삭제", exact: true })
    .click();
  await page
    .getByRole("button", { name: "확인하고 실행", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "생활비 통장", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  let row = page.locator(".trash-row").filter({ hasText: "생활비 통장" });
  await row.getByRole("button", { name: "복원", exact: true }).click();
  await page
    .getByRole("button", { name: "확인하고 실행", exact: true })
    .click();
  await expect(row).not.toBeVisible();
  await page.getByRole("button", { name: "자산 관리", exact: true }).click();
  await page
    .getByRole("button", { name: "생활비 통장 자산 삭제", exact: true })
    .click();
  await page
    .getByRole("button", { name: "확인하고 실행", exact: true })
    .click();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await row.getByRole("button", { name: "영구 삭제", exact: true }).click();
  await page
    .getByRole("button", { name: "확인하고 실행", exact: true })
    .click();
  await expect(row).not.toBeVisible();
});
test("expenses loans and dated records can be deleted", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "고정지출", exact: true }).click();
  await page
    .getByRole("button", { name: "넷플릭스 지출 삭제", exact: true })
    .click();
  await page
    .getByRole("button", { name: "확인하고 실행", exact: true })
    .click();
  await expect(
    page.locator(".desktop-table").getByText("넷플릭스", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "대출 관리", exact: true }).click();
  await page
    .getByRole("button", { name: "주택담보대출 대출 삭제", exact: true })
    .click();
  await page
    .getByRole("button", { name: "확인하고 실행", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "주택담보대출", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "이력 및 통계", exact: true }).click();
  await page
    .getByRole("button", { name: "2026-11-18 기록 삭제", exact: true })
    .click();
  await page
    .getByRole("button", { name: "확인하고 실행", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "2026-11-18 기록 삭제", exact: true }),
  ).not.toBeVisible();
});
test("full clear does not reintroduce deleted data and is recoverable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page
    .getByRole("button", { name: "전체 데이터 삭제", exact: true })
    .click();
  await page
    .getByRole("button", { name: "확인하고 실행", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "자산 관리", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "생활비 통장", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page
    .locator(".trash-row")
    .filter({ hasText: "전체 데이터" })
    .getByRole("button", { name: "복원", exact: true })
    .click();
  await page
    .getByRole("button", { name: "확인하고 실행", exact: true })
    .click();
  await page.getByRole("button", { name: "자산 관리", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "생활비 통장", exact: true }),
  ).toBeVisible();
});
test("mobile grid scrolls internally without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "나의 자산, 한눈에" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page.getByRole("button", { name: "자산 관리", exact: true }).click();
  await page.getByRole("button", { name: "그리드 보기", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".data/visual-review/asset-grid-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("Google setup hides secrets and constructs state PKCE authorization", async ({
  request,
}) => {
  const secret = "test-secret-not-for-response";
  const response = await request.post("/api/google/config", {
    headers: { Origin: origin },
    data: {
      clientId: "test-client.apps.googleusercontent.com",
      clientSecret: secret,
      spreadsheetId: "test-copy",
      redirectUri: `${origin}/api/google/callback`,
    },
  });
  expect(response.ok()).toBe(true);
  const status = await request.get("/api/google/config");
  expect(await status.text()).not.toContain(secret);
  const login = await request.get("/api/google/auth", { maxRedirects: 0 });
  expect(login.status()).toBe(307);
  const url = new URL(login.headers().location);
  expect(url.hostname).toBe("accounts.google.com");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("state")).toBeTruthy();
  expect(url.searchParams.get("scope")).toContain(
    "https://www.googleapis.com/auth/spreadsheets",
  );
  const invalid = await request.get(
    "/api/google/callback?state=invalid&code=invalid",
    { maxRedirects: 0 },
  );
  expect(invalid.headers().location).toContain("oauth=failed");
  expect((await (await request.get("/api/google/config")).json()).enabled).toBe(
    false,
  );
});
for (const width of [1440, 390])
  test(`Google setup screen ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/connect");
    await expect(
      page.getByRole("heading", { name: "실제 Google Sheets 연결" }),
    ).toBeVisible();
    await expect(page.getByLabel("Google 클라이언트 시크릿")).toHaveAttribute(
      "type",
      "password",
    );
    await expect(page.getByLabel("Google 클라이언트 시크릿")).toHaveValue("");
    await expect(page.getByLabel("최초 연결 데이터")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.data/visual-review/google-setup-${width}.png`,
      fullPage: true,
    });
  });

test("money inputs format pasted amounts and preserve numeric form saves", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "자산 관리", exact: true }).click();
  await page.getByRole("button", { name: "자산 추가", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("자산명", { exact: true }).fill("쉼표 입력 검증");
  const amount = dialog.getByLabel("평가액 (원)", { exact: true });
  await amount.fill("12,345,678");
  await expect(amount).toHaveValue("12,345,678");
  await amount.press("Home");
  await amount.press("ArrowRight");
  await amount.press("ArrowRight");
  await amount.press("ArrowRight");
  await amount.press("Backspace");
  await expect(amount).toHaveValue("1,345,678");
  await amount.fill("");
  await expect(amount).toHaveValue("");
  await amount.fill("0");
  await expect(amount).toHaveValue("0");
  await amount.fill("12345678");
  await dialog.getByLabel("투자원금 (선택)").fill("10,000,000");
  await page.screenshot({path:".data/visual-review/money-input-form.png",fullPage:true});
  await dialog.getByRole("button", { name: "자산 저장", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const state = await (await request.get("/api/state")).json();
  const saved = state.assets.find((a: any) => a.name === "쉼표 입력 검증");
  expect(saved.value).toBe(12345678);
  expect(saved.principal).toBe(10000000);
});

test("expense purposes group items and preserve manual choices after reload", async ({page, request}) => {
  await page.goto("/");
  await page.getByRole("button",{name:"고정지출",exact:true}).click();
  await expect(page.locator(".expense-group-heading").filter({hasText:"주거·공과금"})).toBeVisible();
  await page.getByLabel("세부 용도 필터").selectOption("구독·멤버십");
  await expect(page.locator(".desktop-table").getByText("넷플릭스",{exact:true})).toBeVisible();
  await expect(page.locator(".desktop-table").getByText("통신 요금",{exact:true})).not.toBeVisible();
  await page.getByRole("button",{name:"넷플릭스 수정",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("세부 용도",{exact:true}).selectOption("생활비");
  await dialog.getByRole("button",{name:"지출 저장",exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page.getByRole("button",{name:"고정지출",exact:true}).click();
  await page.getByLabel("세부 용도 필터").selectOption("생활비");
  await expect(page.locator(".desktop-table").getByText("넷플릭스",{exact:true})).toBeVisible();
  const state=await(await request.get("/api/state")).json();
  const expense=state.expenses.find((e:any)=>e.name==="넷플릭스");
  expect(expense.purpose).toBe("생활비");
  expect(expense.category).toBe("소비지출");
});

test("asset groups retain custom and unclassified rows across cards grid search and mobile", async ({page,request})=>{
 const current=await(await request.get("/api/state")).json();
 const synthetic=seedState();
 synthetic.assets[0].category="사용자 분류";synthetic.assets[0].principal=0;
 synthetic.assets[1].category=" ";
 synthetic.assets[2].active=false;
 const restored=await request.post("/api/state",{headers:{Origin:origin},data:{kind:"restore",revision:current.revision,state:synthetic,requestId:crypto.randomUUID()}});
 expect(restored.ok()).toBe(true);
 await page.goto("/");await page.getByRole("button",{name:"자산 관리",exact:true}).click();
 await page.getByRole("button",{name:"카드 보기",exact:true}).click();
 await expect(page.locator(".asset-card")).toHaveCount(synthetic.assets.length);
 await expect(page.getByRole("region",{name:"사용자 분류 자산 그룹"})).toBeVisible();
 await expect(page.getByRole("region",{name:"미분류 자산 그룹"})).toBeVisible();
 await page.getByRole("button",{name:"미분류",exact:true}).click();
 await expect(page.locator(".asset-card")).toHaveCount(1);
 await page.getByRole("button",{name:"그리드 보기",exact:true}).click();
 await expect(page.locator(".asset-edit-table tbody tr:not(.asset-grid-group)")).toHaveCount(1);
 await page.getByRole("button",{name:"전체",exact:true}).click();
 await expect(page.locator(".asset-edit-table tbody tr:not(.asset-grid-group)")).toHaveCount(synthetic.assets.length);
 await page.getByPlaceholder("자산명 또는 금융기관 검색").fill("cma");
 await expect(page.locator(".asset-edit-table tbody tr:not(.asset-grid-group)")).toHaveCount(1);
 await page.getByPlaceholder("자산명 또는 금융기관 검색").fill("없는 이름");
 await expect(page.locator(".asset-edit-table tbody tr:not(.asset-grid-group)")).toHaveCount(0);
 await page.getByRole("button",{name:"카드 보기",exact:true}).click();
 await expect(page.getByText("일치하는 자산이 없습니다. 검색어나 유형 필터를 확인하세요.")).toBeVisible();
 await page.getByPlaceholder("자산명 또는 금융기관 검색").fill("");
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect.poll(() => page.locator(".sidebar").evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(1);
 await page.screenshot({path:".data/visual-review/asset-groups-mobile.png",fullPage:true});
});

test("custom expense purposes are visible and not silently dropped", async ({page,request})=>{
 const current=await(await request.get("/api/state")).json();const s=seedState();
 s.expenses[0].purpose="나만의 용도";
 const r=await request.post("/api/state",{headers:{Origin:origin},data:{kind:"restore",revision:current.revision,state:s,requestId:crypto.randomUUID()}});expect(r.ok()).toBe(true);
 await page.goto("/");await page.getByRole("button",{name:"고정지출",exact:true}).click();
 await page.getByLabel("세부 용도 필터").selectOption("나만의 용도");
 await expect(page.locator(".desktop-table").getByText("주거 관리비",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"주거 관리비 수정",exact:true}).click();
 await expect(page.getByRole("dialog").getByLabel("세부 용도",{exact:true})).toHaveValue("나만의 용도");
});
