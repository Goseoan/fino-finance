import {
  type State,
  type Expense,
  stateSchema,
  monthlyEquivalent,
} from "./domain";
import { expensePurpose } from "./expense-purpose";
import { applyUpdate } from "./mutations";
export const CASHFLOW_CATEGORIES: Expense["category"][] = [
  "소비지출",
  "생활비예산",
  "저축·투자",
  "급여공제",
  "대출상환",
];
export const CASHFLOW_HELP: Record<Expense["category"], string> = {
  소비지출:
    "보험·통신·공과금·구독 등 실제로 납부할 비용입니다. 월 환산 소비와 전체 배정액에 포함합니다.",
  생활비예산:
    "식비·장보기 등 아직 개별 지출로 기록하지 않은 생활비 배정액입니다. 전체 배정액에만 포함하며, 같은 비용의 개별 납부액과 중복 등록하지 마세요.",
  "저축·투자":
    "예금·적금·청약·투자 등 자산으로 옮기는 금액입니다. 전체 배정액에는 포함하지만 소비로 집계하지 않습니다.",
  급여공제:
    "실수령액 입금 전에 차감된 금액입니다. 월 소득을 실수령액으로 입력한 경우 전체 배정액에서 다시 빼지 않습니다.",
  대출상환:
    "대출 목록에 등록한 상환액을 표시하는 참고 항목입니다. 합계에서는 대출 목록의 예상 상환액만 한 번 집계합니다.",
};
const billPurposes = new Set([
  "보험",
  "주거·공과금",
  "통신",
  "세금",
  "구독·멤버십",
  "클라우드·AI",
  "모임·회비",
  "건강·운동",
  "차량·교통",
]);
export function classificationPreview(s: State) {
  return s.expenses
    .filter((e) => e.active && !e.deletedAt && e.category === "생활비예산")
    .flatMap((e) => {
      if (
        /예산|한도|배정|생활비|예비비|급여|공제|대출|상환|저축|적립|청약|연금|투자/.test(
          e.name,
        )
      )
        return [];
      const purpose = expensePurpose(e);
      if (!billPurposes.has(purpose)) return [];
      if (
        !e.purpose &&
        !/통신|인터넷|휴대폰|핸드폰|관리비|전기|가스|보험|구독|넷플릭스|유튜브|드라이브|cloud/i.test(
          e.name,
        )
      )
        return [];
      return [
        {
          id: e.id,
          name: e.name,
          before: e.category,
          after: "소비지출" as const,
          purpose,
          monthly: monthlyEquivalent(e.amount, e.cycle),
          reason: `${purpose} 납부 항목으로 분류되어 있어 생활비 배정액보다 소비지출에 해당합니다.`,
        },
      ];
    });
}
function revisionCheck(s: State, revision: number) {
  if (s.revision !== revision)
    throw Error("저장 충돌: 분류 미리보기를 다시 확인하세요");
}
export function applyClassification(
  s: State,
  ids: string[],
  revision: number,
  batchId: string,
): State {
  revisionCheck(s, revision);
  const available = new Map(classificationPreview(s).map((p) => [p.id, p]));
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !available.has(id))
  )
    throw Error("분류 정정 대상을 다시 확인하세요");
  const desired = {
    ...s,
    expenses: s.expenses.map((e) =>
      ids.includes(e.id) ? { ...e, category: available.get(e.id)!.after } : e,
    ),
  };
  const next = applyUpdate(s, { kind: "update", revision, state: desired });
  for (const row of next.audit)
    if (
      !s.audit.some((a) => a.id === row.id) &&
      row.itemChange?.entity === "expense" &&
      ids.includes(row.itemChange.itemId)
    )
      row.classification = { batchId, operation: "apply" };
  return stateSchema.parse(next);
}
export function lastClassificationBatch(s: State) {
  const undone = new Set(
    s.audit
      .filter((a) => a.classification?.operation === "undo")
      .map((a) => a.classification!.batchId),
  );
  return (
    s.audit.find(
      (a) =>
        a.classification?.operation === "apply" &&
        !undone.has(a.classification.batchId),
    )?.classification?.batchId ?? null
  );
}
export function undoClassification(
  s: State,
  batchId: string,
  revision: number,
): State {
  revisionCheck(s, revision);
  if (
    s.audit.some(
      (a) =>
        a.classification?.batchId === batchId &&
        a.classification.operation === "undo",
    )
  )
    throw Error("이미 되돌린 분류 정비입니다");
  const rows = s.audit.filter(
    (a) =>
      a.classification?.batchId === batchId &&
      a.classification.operation === "apply" &&
      a.itemChange?.entity === "expense",
  );
  if (!rows.length) throw Error("되돌릴 분류 이력이 없습니다");
  const desired = structuredClone(s);
  for (const row of rows) {
    const change = row.itemChange!;
    const item = desired.expenses.find((e) => e.id === change.itemId);
    if (
      change.entity !== "expense" ||
      !change.before ||
      !item ||
      !item.active ||
      item.deletedAt ||
      item.category !== change.after.category
    )
      throw Error("저장 충돌: 이후 변경된 분류는 자동으로 되돌릴 수 없습니다");
    item.category = change.before.category;
  }
  const next = applyUpdate(s, { kind: "update", revision, state: desired });
  for (const row of next.audit)
    if (
      !s.audit.some((a) => a.id === row.id) &&
      row.itemChange?.entity === "expense" &&
      rows.some((a) => a.itemChange?.itemId === row.itemChange?.itemId)
    )
      row.classification = { batchId, operation: "undo" };
  return stateSchema.parse(next);
}
