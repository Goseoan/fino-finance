import { State, stateSchema, type Expense, type Loan } from "./domain";
export type SourceSheet = { name: string; rows: unknown[][] };
export function migrateSource(source: SourceSheet[]): State {
  const rows = (name: string) =>
    source
      .find((s) => s.name === name)
      ?.rows.slice(1)
      .filter((r) => r[0]) ?? [];
  const history = rows("05_이력분석")
    .filter((r) => typeof r[7] === "number")
    .map((r) => ({
      date: String(r[1]),
      sourceDate: String(r[2]),
      assets: Number(r[7]),
      debt: Number(r[8]),
      note: String(r[11] ?? ""),
    }));
  const last = history.at(-1);
  const settings = source.find((s) => s.name === "06_설정·가이드")?.rows ?? [];
  const salary = Number(settings[4]?.[1]) || 0,
    otherIncome = Number(settings[5]?.[1]) || 0,
    annualIncome = Number(settings[6]?.[1]) || 0;
  const sourceDate = last?.sourceDate ?? "2026-04-15";
  const assets = rows("02_자산현황").map((r) => ({
    id: String(r[0]),
    category: String(r[1]) === "동산" ? "기타" : String(r[1]),
    name: String(r[3]),
    institution: String(r[3]).match(/\(([^)]+)\)/)?.[1] ?? String(r[2]),
    value: Number(r[4]),
    principal: typeof r[5] === "number" ? r[5] : null,
    date: sourceDate,
    active: true,
  }));
  if (!assets.length) throw Error("자산 데이터가 없습니다");
  const loans: Loan[] = rows("03_대출관리").map((r) => ({
    id: String(r[0]),
    name: String(r[1]),
    principal: Number(r[2]),
    rate: Number(r[3]) * 100,
    monthlyPrincipal: Number(r[4]),
    months: null,
    method: Number(r[4]) > 0 ? "원금균등" : "만기일시",
    maturity: null,
    rateDate: null,
    verified: false,
    active: true,
  }));
  const expenses: Expense[] = rows("01_월고정지출").map((r) => ({
    id: String(r[0]),
    name: String(r[2]),
    category: String(r[3]) as Expense["category"],
    amount: Math.round(Number(r[5]) || 0),
    cycle: String(r[4]) as Expense["cycle"],
    day: typeof r[7] === "number" && r[7] >= 1 && r[7] <= 31 ? r[7] : null,
    account: String(r[8] ?? ""),
    active: !["중지", "보류"].includes(String(r[9])),
  }));
  const total = assets.reduce((s, a) => s + a.value, 0),
    debt = loans.reduce((s, l) => s + l.principal, 0);
  if (last && (last.assets !== total || last.debt !== debt))
    throw Error("이관 합계 불일치: 자산과 이력 기록을 대조하세요");
  return stateSchema.parse({
    version: 1,
    revision: 0,
    mode: "imported",
    assets,
    expenses,
    loans,
    snapshots: [
      {
        date: last?.date ?? "2026-08-08",
        values: Object.fromEntries(assets.map((a) => [a.id, a.value])),
        confirmed: [],
        debt,
      },
    ],
    history,
    audit: [],
    settings: { income: salary + otherIncome, annualIncome, currency: "KRW" },
    updatedAt: "2026-11-20T10:40:00+09:00",
  });
}
