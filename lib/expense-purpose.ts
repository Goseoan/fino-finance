import type { Expense } from "./domain";
export const EXPENSE_PURPOSES = [
  "생활비",
  "연금",
  "저축·청약",
  "투자",
  "보험",
  "주거·공과금",
  "차량·교통",
  "세금",
  "통신",
  "가족 지원",
  "건강·운동",
  "모임·회비",
  "구독·멤버십",
  "클라우드·AI",
  "대출 상환",
  "검토 필요",
  "기타",
  "미분류",
] as const;
export type ExpensePurpose = (typeof EXPENSE_PURPOSES)[number];
/** Names give a suggested purpose; cash-flow categories remain independent. */
export function expensePurpose(
  e: Pick<Expense, "name" | "category" | "purpose">,
): string {
  if (e.purpose) return e.purpose;
  const name = e.name.toLowerCase().replace(/\s/g, "");
  if (/엄마|부모|시골집|가족/.test(name)) return "가족 지원";
  if (/(?:^|[^a-z])irp(?:$|[^a-z])|연금/.test(name)) return "연금";
  if (/적금|청약|예금/.test(name)) return "저축·청약";
  if (/(?:^|[^a-z])isa(?:$|[^a-z])|주식|우리사주|출자금|정기투자/.test(name)) return "투자";
  if (/보험/.test(name)) return "보험";
  if (/재산세|주민세|자동차세|세금/.test(name)) return "세금";
  if (/월세|관리비|전기(?:세|료|요금)|^전기$|가스(?:비|료|요금)|수도(?:세|료|요금)/.test(name)) return "주거·공과금";
  if (/유류|주유|교통|주차|하이패스/.test(name)) return "차량·교통";
  if (/핸드폰|휴대폰|통신|인터넷|스카이라이프/.test(name)) return "통신";
  if (/헬스|운동|건강|병원/.test(name)) return "건강·운동";
  if (/회비/.test(name)) return "모임·회비";
  if (/클라우드|cloud|구글드라이브|onedrive|chatgpt|챗지피티|openai/.test(name))
    return "클라우드·AI";
  if (/ott|티빙|유튜브|넷플릭스|구독|멤버십|쿠팡와우/.test(name))
    return "구독·멤버십";
  if (e.category === "생활비예산") return "생활비";
  if (e.category === "저축·투자" || /쿠팡|올원패스/.test(name))
    return "검토 필요";
  if (e.category === "대출상환") return "대출 상환";
  return "미분류";
}
