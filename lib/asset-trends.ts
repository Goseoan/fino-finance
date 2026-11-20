import { classificationLabel } from "./classification";
import type { State } from "./domain";
export type TrendPoint = {
  date: string;
  value: number;
  confirmed: boolean;
  imported?: boolean;
  sourceDate?: string;
};
function records(state: State) {
  const dates = new Set([
    ...state.snapshots.map((p) => p.date),
    ...(state.assetHistory ?? []).map((p) => p.date),
  ]);
  return [...dates].sort().map((date) => {
    const imported = state.assetHistory?.find((p) => p.date === date),
      snapshot = state.snapshots.find((p) => p.date === date);
    return {
      date,
      values: { ...imported?.values, ...snapshot?.values },
      confirmed: snapshot?.confirmed ?? [],
      importedIds: new Set(
        Object.keys(imported?.values ?? {}).filter(
          (id) => !Object.hasOwn(snapshot?.values ?? {}, id),
        ),
      ),
      sourceDate: imported?.sourceDate,
    };
  });
}
export function assetTrend(state: State, id: string): TrendPoint[] {
  return records(state)
    .filter((s) => Object.hasOwn(s.values, id))
    .map((s) => ({
      date: s.date,
      value: s.values[id],
      confirmed: s.confirmed.includes(id),
      ...(s.importedIds.has(id)
        ? {
            imported: true,
            ...(s.sourceDate ? { sourceDate: s.sourceDate } : {}),
          }
        : {}),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function categoryTrend(state: State, category: string): TrendPoint[] {
  const ids = new Set(
    state.assets
      .filter(
        (a) =>
          classificationLabel(a.category) === classificationLabel(category),
      )
      .map((a) => a.id),
  );
  return records(state)
    .flatMap((s) => {
      const members = Object.keys(s.values).filter((id) => ids.has(id));
      return members.length
        ? [
            {
              date: s.date,
              value: members.reduce((n, id) => n + s.values[id], 0),
              confirmed: members.every((id) => s.confirmed.includes(id)),
              ...(members.some((id) => s.importedIds.has(id))
                ? {
                    imported: true,
                    ...(s.sourceDate ? { sourceDate: s.sourceDate } : {}),
                  }
                : {}),
            },
          ]
        : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function filterTrend(points: TrendPoint[], period: string) {
  if (period === "전체" || !points.length) return points;
  const end = new Date(`${points.at(-1)!.date}T00:00:00Z`);
  const months = (
    { "3개월": 3, "6개월": 6, "1년": 12 } as Record<string, number>
  )[period];
  if (!months) return points;
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() - months);
  const last = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
  ).getUTCDate();
  end.setUTCDate(Math.min(day, last));
  const cutoff = end.toISOString().slice(0, 10);
  return points.filter((p) => p.date >= cutoff);
}
