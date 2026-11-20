import type { State } from "./domain";
export function assetJournal(state: State, assetId: string) {
  return state.audit
    .filter(
      (row) =>
        row.assetId === assetId &&
        typeof row.afterValue === "number" &&
        !!row.effectiveDate,
    )
    .slice()
    .reverse();
}
