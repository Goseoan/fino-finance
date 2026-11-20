import { type State, stateSchema, dateSchema } from "./domain";
import type { SourceSheet } from "./migration";
export type HistoricalAssets = NonNullable<State["assetHistory"]>;
const key = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s()·_\-/]/g, "");
const validAmount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= 9_000_000_000_000;
export function parseHistoricalAssets(
  tabs: SourceSheet[],
  assets: State["assets"],
  aliases: State["assets"] = [],
) {
  const lookup = new Map<string, Set<string>>();
  for (const a of assets.filter((a) => !a.deletedAt)) {
    for (const name of [
      a.name,
      ...aliases.filter((b) => b.id === a.id).map((b) => b.name),
    ]) {
      const k = key(name);
      if (k) lookup.set(k, new Set([...(lookup.get(k) ?? []), a.id]));
    }
  }
  let skippedTabs = 0,
    unmatched = 0,
    ambiguous = 0;
  const records: HistoricalAssets = [];
  for (const tab of tabs) {
    if (!/^\d{8}$/.test(tab.name)) continue;
    const date = tab.name.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
    if (!dateSchema.safeParse(date).success) {
      skippedTabs++;
      continue;
    }
    const header = tab.rows.findIndex(
      (r) => r[0] === "대구분" && r[2] === "소구분" && r[3] === "현저축액",
    );
    if (header < 0) {
      skippedTabs++;
      continue;
    }
    const entries = new Map<string, number[]>();
    for (const row of tab.rows.slice(header + 1)) {
      if (!row[0] && !row[1] && !row[2]) break;
      if (!validAmount(row[3])) continue;
      // Prefer exact composite labels to broad, potentially ambiguous component labels.
      const composite = lookup.get(
        key(String(row[1] ?? "") + String(row[2] ?? "")),
      );
      const reversed=lookup.get(key(String(row[2]??"")+String(row[1]??"")));
      const generic=new Set(["현금","투자","주식","연금","입출금","출자금","적금","청약","예금","기타","동산","부동산","보험"]);
      const candidates = composite?.size ? composite : reversed?.size ? reversed : new Set(
        [row[1],row[2]].filter(value=>!generic.has(String(value??"").trim())).flatMap(value=>[...(lookup.get(key(value))??[])])
      );
      if (candidates.size !== 1) {
        candidates.size ? ambiguous++ : unmatched++;
        continue;
      }
      const id = [...candidates][0];
      entries.set(id, [...(entries.get(id) ?? []), row[3]]);
    }
    const values: Record<string, number> = {};
    for (const [id, measurements] of entries)
      if (measurements.length === 1) values[id] = measurements[0];
      else ambiguous += measurements.length;
    if (!Object.keys(values).length) {
      skippedTabs++;
      continue;
    }
    const rawDate = String(tab.rows[0]?.[1] ?? "");
    const sourceDate = dateSchema.safeParse(rawDate).success
      ? rawDate
      : undefined;
    records.push({ date, values, ...(sourceDate ? { sourceDate } : {}) });
  }
  return {
    records: records.sort((a, b) => a.date.localeCompare(b.date)),
    skippedTabs,
    unmatched,
    ambiguous,
  };
}
export function mergeHistoricalAssets(
  state: State,
  incoming: HistoricalAssets,
) {
  const next = structuredClone(state);
  const known = new Set(
    state.assets.filter((a) => !a.deletedAt).map((a) => a.id),
  );
  const deletedDates = new Set(
    state.trash?.filter((t) => t.entity === "record").map((t) => t.label),
  );
  const dates = new Map((next.assetHistory ?? []).map((p) => [p.date, p]));
  let addedValues = 0,
    conflicts = 0;
  for (const record of incoming) {
    if (deletedDates.has(record.date)) continue;
    const existing = dates.get(record.date);
    const values = { ...(existing?.values ?? {}) };
    const snapshot = state.snapshots.find((p) => p.date === record.date);
    for (const [id, value] of Object.entries(record.values)) {
      if (!known.has(id)) continue;
      if (snapshot && Object.hasOwn(snapshot.values, id)) {
        if (snapshot.values[id] !== value) conflicts++;
        continue;
      }
      if (Object.hasOwn(values, id)) {
        if (values[id] !== value) conflicts++;
        continue;
      }
      values[id] = value;
      addedValues++;
    }
    if (Object.keys(values).length)
      dates.set(record.date, {
        date: record.date,
        values,
        ...((existing?.sourceDate ?? record.sourceDate)
          ? { sourceDate: existing?.sourceDate ?? record.sourceDate }
          : {}),
      });
  }
  if (addedValues) {
    next.assetHistory = [...dates.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    next.revision++;
    next.updatedAt = new Date().toISOString();
    next.audit.unshift({
      id: crypto.randomUUID(),
      at: next.updatedAt,
      description: `과거 자산 상세 ${addedValues}개 값 가져오기`,
    });
  }
  return {
    state: stateSchema.parse(next),
    addedValues,
    conflicts,
    dates: dates.size,
  };
}
