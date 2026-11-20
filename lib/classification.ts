/** Display-only normalization; persisted labels and identifiers are never rewritten. */
export const ASSET_TYPES = [
  "현금",
  "투자",
  "연금",
  "부동산",
  "기타",
  "미분류",
] as const;
const collator = new Intl.Collator("ko-KR", {
  numeric: true,
  sensitivity: "base",
});
export const classificationLabel = (value: string | null | undefined) =>
  value?.normalize("NFC").trim().replace(/\s+/g, " ") || "미분류";
export function orderedLabels(
  labels: readonly string[],
  standard: readonly string[],
) {
  return [...new Set(labels.map(classificationLabel))].sort((a, b) => {
    const ai = standard.indexOf(a),
      bi = standard.indexOf(b);
    if (ai >= 0 || bi >= 0) return ai < 0 ? 1 : bi < 0 ? -1 : ai - bi;
    return collator.compare(a, b);
  });
}
export function compareNamed(
  a: { name: string; id: string },
  b: { name: string; id: string },
) {
  return collator.compare(a.name, b.name) || collator.compare(a.id, b.id);
}
export function groupAssets<
  T extends {
    id: string;
    name: string;
    category: string;
    value: number;
    active: boolean;
    deletedAt?: string;
  },
>(assets: readonly T[]) {
  const visible = assets.filter((a) => !a.deletedAt);
  return orderedLabels(
    visible.map((a) => a.category),
    ASSET_TYPES,
  ).map((label) => {
    const items = visible
      .filter((a) => classificationLabel(a.category) === label)
      .sort(compareNamed);
    return {
      label,
      items,
      count: items.length,
      activeCount: items.filter((a) => a.active).length,
      total: items.reduce((sum, a) => sum + (a.active ? a.value : 0), 0),
    };
  });
}
export const cashflowLabel = (value: string) =>
  ({
    소비지출: "소비 지출",
    생활비예산: "생활비 예산",
    급여공제: "급여 공제",
    대출상환: "대출 상환",
  })[value] ?? value;
