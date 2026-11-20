import {
  type State,
  type Expense,
  type Loan,
  monthlyEquivalent,
  loanMonthly,
} from "./domain";
export type ItemEntity = "expense" | "loan";
type Change = NonNullable<State["audit"][number]["itemChange"]>;
export type ItemEvent<E extends ItemEntity = ItemEntity> = Extract<
  Change,
  { entity: E }
> & { id: string; at: string };
export function itemJournal<E extends ItemEntity>(
  state: State,
  entity: E,
  itemId: string,
): ItemEvent<E>[] {
  return state.audit
    .filter(
      (row) =>
        row.itemChange?.entity === entity && row.itemChange.itemId === itemId,
    )
    .slice()
    .reverse()
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((row) => ({
      ...row.itemChange!,
      id: row.id,
      at: row.at,
    })) as ItemEvent<E>[];
}
export function appendItemChanges(
  before: State,
  after: State,
  action: "수정" | "삭제" | "복원" = "수정",
) {
  for (const entity of ["expense", "loan"] as const) {
    const prior = entity === "expense" ? before.expenses : before.loans,
      next = entity === "expense" ? after.expenses : after.loans;
    for (const item of next) {
      const old = prior.find((row) => row.id === item.id) ?? null;
      if (JSON.stringify(old) === JSON.stringify(item)) continue;
      const common = {
        itemId: item.id,
        action: old ? action : ("등록" as const),
      };
      const itemChange: Change =
        entity === "expense"
          ? {
              ...common,
              entity,
              before: structuredClone(old) as Expense | null,
              after: structuredClone(item) as Expense,
            }
          : {
              ...common,
              entity,
              before: structuredClone(old) as Loan | null,
              after: structuredClone(item) as Loan,
            };
      after.audit.unshift({
        id: crypto.randomUUID(),
        at: after.updatedAt,
        description: `${entity === "expense" ? "고정지출" : "대출"} ${common.action} 기록`,
        itemChange,
      });
    }
  }
}
export const ITEM_METRICS = {
  expense: [
    { key: "amount", label: "회당 납부액", unit: "원" },
    { key: "monthly", label: "월 환산 납부액", unit: "원" },
  ],
  loan: [
    { key: "principal", label: "잔여 원금", unit: "원" },
    { key: "rate", label: "연 금리", unit: "%" },
    { key: "payment", label: "예상 월 상환액", unit: "원" },
  ],
} as const;
export function journalMetric(
  event: ItemEvent,
  metric: string,
  phase: "before" | "after",
): number | null {
  const item = phase === "before" ? event.before : event.after;
  if (!item) return null;
  if (event.entity === "expense") {
    const e = item as Expense;
    return metric === "monthly"
      ? monthlyEquivalent(e.amount, e.cycle)
      : e.amount;
  }
  const loan = item as Loan;
  if (metric === "rate") return loan.rate;
  if (metric === "payment") {
    if (!loan.active || loan.deletedAt) return 0;
    if (
      loan.months === null &&
      loan.method !== "만기일시" &&
      !(loan.method === "원금균등" && loan.monthlyPrincipal > 0)
    )
      return null;
    return loanMonthly(loan);
  }
  return loan.principal;
}
export const ITEM_FIELDS = {
  expense: {
    name: "항목명",
    category: "현금흐름 구분",
    purpose: "세부 용도",
    amount: "회당 납부액",
    cycle: "납부주기",
    day: "납부일",
    account: "출금계좌",
    dueDate: "다음 납부일",
    maturityDate: "만기",
    note: "메모",
    active: "활성 상태",
    deletedAt: "삭제 시각",
  },
  loan: {
    name: "대출명",
    principal: "잔여 원금",
    rate: "연 금리",
    months: "남은 개월 수",
    method: "상환 방식",
    monthlyPrincipal: "약정 월 원금",
    maturity: "만기",
    rateDate: "금리 변경일",
    verified: "계약 확인",
    active: "상환 상태",
    deletedAt: "삭제 시각",
  },
};
export function changedItemFields(event: ItemEvent) {
  const before = event.before as unknown as Record<string, unknown> | null,
    after = event.after as unknown as Record<string, unknown>;
  return Object.entries(ITEM_FIELDS[event.entity])
    .filter(
      ([key]) => JSON.stringify(before?.[key]) !== JSON.stringify(after[key]),
    )
    .map(([key, label]) => ({
      key,
      label,
      before: before?.[key],
      after: after[key],
    }));
}
