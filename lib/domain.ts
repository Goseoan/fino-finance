import { z } from "zod";
export const amount = z.number().int().min(0).max(9_000_000_000_000);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "유효한 날짜를 입력하세요",
  );
const meta = {
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  active: z.boolean(),
  deletedAt: z.string().optional(),
};
export const assetSchema = z.object({
  ...meta,
  category: z.string().min(1),
  institution: z.string(),
  value: amount,
  principal: amount.nullable(),
  date: dateSchema,
});
export const expenseSchema = z.object({
  ...meta,
  purpose: z.string().trim().min(1).max(80).optional(),
  category: z.enum([
    "소비지출",
    "생활비예산",
    "저축·투자",
    "급여공제",
    "대출상환",
  ]),
  amount,
  cycle: z.enum(["월", "분기", "6개월", "연"]),
  day: z.number().int().min(1).max(31).nullable(),
  account: z.string(),
  dueDate: dateSchema.optional(),
  maturityDate: dateSchema.optional(),
  note: z.string().optional(),
});
export const loanSchema = z.object({
  ...meta,
  principal: amount,
  rate: z.number().min(0).max(100),
  months: z.number().int().min(1).max(600).nullable(),
  method: z.enum(["원리금균등", "원금균등", "만기일시"]),
  monthlyPrincipal: amount,
  maturity: dateSchema.nullable(),
  rateDate: dateSchema.nullable(),
  verified: z.boolean(),
});
const snapshotSchema = z.object({
  date: dateSchema,
  values: z.record(z.string(), amount),
  confirmed: z.array(z.string()),
  debt: amount,
});
export const stateSchema = z
  .object({
    version: z.literal(1),
    revision: z.number().int().min(0),
    mode: z.enum(["demo", "imported", "local", "sheets"]),
    lastRequestId: z.string().optional(),
    trash: z
      .array(
        z.object({
          id: z.string(),
          entity: z.enum([
            "asset",
            "expense",
            "loan",
            "record",
            "audit",
            "all",
          ]),
          label: z.string(),
          deletedAt: z.string(),
          data: z.unknown(),
        }),
      )
      .optional(),
    assets: z.array(assetSchema),
    expenses: z.array(expenseSchema),
    loans: z.array(loanSchema),
    snapshots: z.array(snapshotSchema),
    history: z.array(
      z.object({
        date: z.string(),
        sourceDate: z.string(),
        assets: amount,
        debt: amount,
        note: z.string(),
      }),
    ),
    audit: z.array(
      z.object({ id: z.string(), at: z.string(), description: z.string() }),
    ),
    settings: z.object({
      income: amount,
      annualIncome: amount,
      currency: z.literal("KRW"),
      assetCategories: z
        .array(z.string().trim().min(1).max(20))
        .min(1)
        .max(20)
        .refine((v) => new Set(v).size === v.length)
        .optional(),
    }),
    updatedAt: z.string(),
  })
  .superRefine((s, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    for (const list of [s.assets, s.expenses, s.loans])
      if (new Set(list.map((x) => x.id)).size !== list.length) fail("중복 ID");
    if (new Set(s.snapshots.map((x) => x.date)).size !== s.snapshots.length)
      fail("중복 스냅샷 날짜");
    const ids = new Set(s.assets.map((a) => a.id));
    for (let i = 0; i < s.snapshots.length; i++) {
      const snap = s.snapshots[i];
      if (i && s.snapshots[i - 1].date >= snap.date) fail("스냅샷 날짜 순서");
      if (
        Object.keys(snap.values).some((id) => !ids.has(id)) ||
        snap.confirmed.some((id) => !(id in snap.values))
      )
        fail("알 수 없는 자산 참조");
    }
  });
export type Asset = z.infer<typeof assetSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type Loan = z.infer<typeof loanSchema>;
export type State = z.infer<typeof stateSchema>;
export const won = (n: number) =>
  new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(n);
export const compact = (n: number) =>
  Math.abs(n) >= 100_000_000
    ? `${(n / 100_000_000).toFixed(2)}억`
    : `${won(n / 10000)}만`;
export const monthlyEquivalent = (n: number, cycle: string) =>
  n / ({ 월: 1, 분기: 3, "6개월": 6, 연: 12 }[cycle] ?? 1);
export function payment(
  principal: number,
  rate: number,
  months: number,
  method: string,
) {
  const r = rate / 1200;
  if (method === "만기일시") return Math.round(principal * r);
  if (method === "원금균등")
    return Math.round(principal / months + principal * r);
  return Math.round(
    r === 0 ? principal / months : (principal * r) / (1 - (1 + r) ** -months),
  );
}
export function loanMonthly(l: Loan) {
  return l.method === "원금균등" && l.monthlyPrincipal > 0
    ? Math.round(l.monthlyPrincipal + (l.principal * l.rate) / 1200)
    : payment(l.principal, l.rate, l.months ?? 1, l.method);
}
export function cashflow(s: State) {
  const active = s.expenses.filter((e) => e.active);
  const loan = s.loans
    .filter((l) => l.active)
    .reduce((t, l) => t + loanMonthly(l), 0);
  const budget =
    active
      .filter((e) => e.category !== "급여공제" && e.category !== "대출상환")
      .reduce((t, e) => t + monthlyEquivalent(e.amount, e.cycle), 0) + loan;
  return {
    budget,
    remaining: s.settings.income - budget,
    loan,
    consumption: active
      .filter((e) => e.category === "소비지출")
      .reduce((t, e) => t + monthlyEquivalent(e.amount, e.cycle), 0),
  };
}
export function totals(s: State) {
  const assets = s.assets
    .filter((a) => a.active)
    .reduce((t, a) => t + a.value, 0);
  const debt = s.loans
    .filter((l) => l.active)
    .reduce((t, l) => t + l.principal, 0);
  return { assets, debt, net: assets - debt };
}
export function saveSnapshot(
  state: State,
  input: { date: string; changes: Record<string, number>; revision: number },
) {
  if (input.revision !== state.revision)
    throw Error("저장 충돌: 최신 데이터를 다시 불러오세요");
  dateSchema.parse(input.date);
  z.record(z.string(), amount).parse(input.changes);
  if (
    Object.keys(input.changes).some(
      (id) => !state.assets.some((a) => a.id === id),
    )
  )
    throw Error("알 수 없는 자산");
  if (state.snapshots.length && input.date < state.snapshots[0].date)
    throw Error("최초 기록 이전 날짜는 잔액 근거가 없습니다");
  const s = structuredClone(state);
  const prior = s.snapshots
    .filter((x) => x.date <= input.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  const existing = s.snapshots.find((x) => x.date === input.date);
  const raw = {
    ...Object.fromEntries(s.assets.map((a) => [a.id, a.value])),
    ...(prior?.values ?? {}),
    ...input.changes,
  };
  const isHistorical = input.date < (s.snapshots.at(-1)?.date ?? input.date);
  const memberIds = isHistorical
    ? Object.keys(existing?.values ?? prior?.values ?? raw)
    : s.assets.filter((a) => a.active).map((a) => a.id);
  const values = Object.fromEntries(memberIds.map((id) => [id, raw[id]]));
  const debt = isHistorical
    ? (existing?.debt ?? prior?.debt ?? totals(s).debt)
    : totals(s).debt;
  if (
    existing &&
    JSON.stringify(existing.values) === JSON.stringify(values) &&
    existing.debt === debt
  )
    return s;
  const snapshot = {
    date: input.date,
    values,
    confirmed: [
      ...new Set([
        ...(existing?.confirmed ?? []),
        ...Object.keys(input.changes),
      ]),
    ].filter((id) => id in values),
    debt,
  };
  s.snapshots = s.snapshots
    .filter((x) => x.date !== input.date)
    .concat(snapshot)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const [id, value] of Object.entries(input.changes)) {
    for (const later of s.snapshots.filter((x) => x.date > input.date)) {
      if (later.confirmed.includes(id)) break;
      if (id in later.values) later.values[id] = value;
    }
  }
  const latest = s.snapshots.at(-1)!;
  s.assets = s.assets.map((a) => ({
    ...a,
    value: latest.values[a.id] ?? a.value,
    date:
      [...s.snapshots].reverse().find((x) => x.confirmed.includes(a.id))
        ?.date ?? a.date,
  }));
  s.revision++;
  s.updatedAt = new Date().toISOString();
  s.audit.unshift({
    id: crypto.randomUUID(),
    at: s.updatedAt,
    description: `${input.date} 자산 기록 · ${Object.keys(input.changes).length}개 변경`,
  });
  return stateSchema.parse(s);
}
export function seedState(): State {
  const specs: [string, string, string, number, number | null][] = [
    ["생활비 통장", "현금", "신한은행", 4280000, null],
    ["모으기 통장", "현금", "토스뱅크", 12500000, null],
    ["CMA 파킹통장", "현금", "미래에셋증권", 24600000, 24000000],
    ["국내·해외 주식", "투자", "키움증권", 68240000, 55000000],
    ["중개형 ISA", "투자", "신한투자증권", 32800000, 30000000],
    ["퇴직연금 IRP", "연금", "신한은행", 42600000, 38000000],
    ["연금저축", "연금", "삼성증권", 28400000, 26000000],
    ["우리 집", "부동산", "주거 자산", 680000000, null],
    ["자동차", "기타", "기타 자산", 18500000, null],
  ];
  const assets = specs.map(
    ([name, category, institution, value, principal], i) => ({
      id: `demo-a${i}`,
      name,
      category,
      institution,
      value,
      principal,
      date: "2026-11-18",
      active: true,
    }),
  );
  const expenses: Expense[] = [
    ["주거 관리비", "소비지출", 185000, "월", 25, "생활비 통장"],
    ["통신 요금", "소비지출", 69000, "월", 21, "생활비 통장"],
    ["건강보험", "소비지출", 128000, "월", 25, "생활비 통장"],
    ["생활비 예산", "생활비예산", 1000000, "월", 1, "생활비 통장"],
    ["정기 적금", "저축·투자", 400000, "월", 25, "모으기 통장"],
    ["자동차 보험", "소비지출", 720000, "연", 15, "생활비 통장"],
    ["넷플릭스", "소비지출", 17000, "월", 22, "생활비 통장"],
    ["우리사주 공제", "급여공제", 200000, "월", 25, "급여"],
  ].map((r, i) => ({
    id: `demo-e${i}`,
    name: r[0],
    category: r[1],
    amount: r[2],
    cycle: r[3],
    day: r[4],
    account: r[5],
    active: true,
  })) as Expense[];
  const loans: Loan[] = [
    {
      id: "demo-l1",
      name: "주택담보대출",
      principal: 420000000,
      rate: 3.8,
      months: 360,
      method: "원리금균등",
      monthlyPrincipal: 0,
      maturity: "2054-11-25",
      rateDate: "2027-05-25",
      verified: true,
      active: true,
    },
  ];
  const current = assets.reduce((t, a) => t + a.value, 0);
  const history = [
    ["2026-01-15", 812000000],
    ["2026-03-12", 834000000],
    ["2026-05-20", 852000000],
    ["2026-07-08", 867000000],
    ["2026-09-15", 889000000],
    ["2026-10-18", 898000000],
    ["2026-11-18", current],
  ].map(([date, value], i) => ({
    date: String(date),
    sourceDate: String(date),
    assets: Number(value),
    debt: 420000000 + (6 - i) * 200000,
    note: "데모 기록",
  }));
  return {
    version: 1,
    revision: 0,
    mode: "demo",
    assets,
    expenses,
    loans,
    snapshots: [
      {
        date: "2026-11-18",
        values: Object.fromEntries(assets.map((a) => [a.id, a.value])),
        confirmed: assets.map((a) => a.id),
        debt: 420000000,
      },
    ],
    history,
    audit: [],
    settings: { income: 6200000, annualIncome: 90000000, currency: "KRW" },
    updatedAt: "2026-11-18T09:00:00.000Z",
  };
}

export function timeline(s: State) {
  const entries = new Map(s.history.map((h) => [h.date, h]));
  for (const snap of s.snapshots) {
    const prior = entries.get(snap.date);
    entries.set(snap.date, {
      date: snap.date,
      sourceDate: prior?.sourceDate ?? snap.date,
      assets: Object.values(snap.values).reduce((a, b) => a + b, 0),
      debt: snap.debt,
      note: prior?.note ?? "자산 스냅샷",
    });
  }
  return [...entries.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function applyAssetEdits(state: State, assets: Asset[]) {
  let s = { ...structuredClone(state), assets };
  for (const asset of assets) {
    const old = state.assets.find((a) => a.id === asset.id);
    if (
      !old ||
      asset.value !== old.value ||
      asset.date !== old.date ||
      asset.active !== old.active
    ) {
      const statusChanged = !!old && asset.active !== old.active;
      const target = statusChanged
        ? [
            new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }),
            s.snapshots.at(-1)?.date ?? asset.date,
          ]
            .sort()
            .at(-1)!
        : asset.active
          ? asset.date
          : (s.snapshots.at(-1)?.date ?? asset.date);
      const verified =
        asset.active &&
        (!old || asset.value !== old.value || asset.date !== old.date);
      s = saveSnapshot(s, {
        date: target,
        changes: verified ? { [asset.id]: asset.value } : {},
        revision: s.revision,
      });
    }
  }
  return s;
}
export function scheduledOutflow(s: State, month: string) {
  const [year, mon] = month.split("-").map(Number);
  const target = year * 12 + mon;
  let scheduled = s.loans
      .filter((l) => l.active)
      .reduce((t, l) => t + loanMonthly(l), 0),
    unknown = 0;
  for (const e of s.expenses) {
    if (!e.active || e.category === "급여공제" || e.category === "대출상환")
      continue;
    if (e.cycle === "월") {
      if (e.day === null) unknown++;
      else scheduled += e.amount;
    } else if (!e.dueDate) unknown++;
    else {
      const [y, m] = e.dueDate.split("-").map(Number);
      const diff = target - (y * 12 + m);
      const interval = { 분기: 3, "6개월": 6, 연: 12 }[e.cycle];
      if (diff >= 0 && diff % interval === 0) scheduled += e.amount;
    }
  }
  return { scheduled, unknown };
}
export function amortization(l: Loan, limit = 12) {
  if (l.months === null) return [];
  const rows = [];
  let balance = l.principal;
  const fixed = payment(l.principal, l.rate, l.months, l.method);
  for (let i = 1; i <= Math.min(limit, l.months) && balance > 0; i++) {
    const interest = Math.round((balance * l.rate) / 1200);
    const principal =
      l.method === "만기일시"
        ? i === l.months
          ? balance
          : 0
        : Math.min(
            balance,
            l.method === "원금균등"
              ? l.monthlyPrincipal || Math.ceil(l.principal / l.months)
              : Math.max(0, fixed - interest),
          );
    balance = Math.max(0, balance - principal);
    rows.push({
      period: i,
      principal,
      interest,
      payment: principal + interest,
      balance,
    });
  }
  return rows;
}
