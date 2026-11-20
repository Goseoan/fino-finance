import type { Asset } from "./domain";
import { classificationLabel, orderedLabels } from "./classification";
export const CASH_TYPES = [
  "입출금",
  "CMA·파킹",
  "정기예금",
  "적금",
  "청약",
  "보유 현금",
  "유형 검토 필요",
  "기타·미분류",
] as const;
export function cashType(
  a: Pick<Asset, "name" | "category" | "cashType">,
): string {
  if (a.cashType) return classificationLabel(a.cashType);
  const name = a.name.normalize("NFKC").toLowerCase().replace(/\s/g, "");
  if (
    /출자금|(?:^|[^a-z])isa(?:$|[^a-z])|(?:^|[^a-z])irp(?:$|[^a-z])|연금|주식/.test(
      name,
    )
  )
    return "유형 검토 필요";
  if (/cma|파킹/.test(name)) return "CMA·파킹";
  if (/청약/.test(name)) return "청약";
  if (/적금/.test(name)) return "적금";
  if (/정기예금/.test(name)) return "정기예금";
  if (/입출금|수시입출금/.test(name)) return "입출금";
  if (/보유현금|지폐|동전/.test(name)) return "보유 현금";
  return "기타·미분류";
}
export function groupCashAssets<T extends Asset>(assets: readonly T[]) {
  return orderedLabels(assets.map(cashType), CASH_TYPES).map((label) => {
    const items = assets.filter((a) => cashType(a) === label);
    return {
      label,
      items,
      count: items.length,
      total: items.reduce((s, a) => s + (a.active ? a.value : 0), 0),
    };
  });
}
