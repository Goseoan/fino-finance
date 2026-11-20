import { z } from "zod";
import { State, stateSchema, saveSnapshot, applyAssetEdits } from "./domain";
const request = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("delete"),
    entity: z.enum(["asset", "expense", "loan", "record", "audit"]),
    ids: z.array(z.string()).min(1).max(500),
    revision: z.number(),
  }),
  z.object({
    kind: z.enum(["restoreTrash", "purgeTrash"]),
    id: z.string(),
    revision: z.number(),
  }),
  z.object({ kind: z.enum(["clearAll", "clearAudit"]), revision: z.number() }),
]);
export type DeleteEntity = "asset" | "expense" | "loan" | "record" | "audit";
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
function dateNow(s: State) {
  return [today(), s.snapshots.at(-1)?.date ?? today()].sort().at(-1)!;
}
function refreshCurrent(s: State) {
  const last = s.snapshots.at(-1);
  if (last)
    s.assets = s.assets.map((a) => ({
      ...a,
      value: last.values[a.id] ?? a.value,
      date:
        [...s.snapshots].reverse().find((p) => p.confirmed.includes(a.id))
          ?.date ?? a.date,
    }));
}
function purgeAssetReferences(state: State, id: string) {
  state.assets = state.assets.filter((a) => a.id !== id);
  state.audit = state.audit.filter((row) => row.assetId !== id);
  const clean = (p: State["snapshots"][number]) => ({
    ...p,
    values: Object.fromEntries(
      Object.entries(p.values).filter(([k]) => k !== id),
    ),
    confirmed: p.confirmed.filter((k) => k !== id),
  });
  state.snapshots = state.snapshots.map(clean);
  const cleanImported = (p: NonNullable<State["assetHistory"]>[number]) => ({
    ...p,
    values: Object.fromEntries(
      Object.entries(p.values).filter(([key]) => key !== id),
    ),
  });
  state.assetHistory = state.assetHistory?.map(cleanImported);
  state.trash = state.trash?.flatMap((t) => {
    if (t.entity === "asset" && (t.data as { id: string }).id === id) return [];
    if (t.entity === "audit" && Array.isArray(t.data))
      return [
        {
          ...t,
          data: t.data.filter(
            (row: { assetId?: string }) => row.assetId !== id,
          ),
        },
      ];
    if (t.entity === "record") {
      const data = t.data as {
        snapshot?: State["snapshots"][number];
        assetHistory?: State["assetHistory"];
      };
      return [
        {
          ...t,
          data: {
            ...data,
            ...(data.snapshot ? { snapshot: clean(data.snapshot) } : {}),
            ...(data.assetHistory
              ? { assetHistory: data.assetHistory.map(cleanImported) }
              : {}),
          },
        },
      ];
    }
    if (t.entity === "all") {
      const saved = stateSchema.parse(t.data);
      purgeAssetReferences(saved, id);
      return [{ ...t, data: saved }];
    }
    return [t];
  });
}
export function mutateState(original: State, input: unknown): State {
  const op = request.parse(input);
  if (op.revision !== original.revision)
    throw Error("저장 충돌: 최신 데이터를 다시 불러오세요");
  let s = structuredClone(original);
  s.trash ??= [];
  const at = new Date().toISOString();
  const push = (
    entity: NonNullable<State["trash"]>[number]["entity"],
    label: string,
    data: unknown,
  ) =>
    s.trash!.unshift({
      id: crypto.randomUUID(),
      entity,
      label,
      deletedAt: at,
      data,
    });
  if (op.kind === "delete") {
    const ids = [...new Set(op.ids)];
    for (const id of ids) {
      if (["asset", "expense", "loan"].includes(op.entity)) {
        const key =
          op.entity === "asset"
            ? "assets"
            : op.entity === "expense"
              ? "expenses"
              : "loans";
        const item = s[key].find((x) => x.id === id && !x.deletedAt);
        if (!item) throw Error("삭제할 항목을 찾을 수 없습니다");
        push(op.entity, item.name, structuredClone(item));
        item.active = false;
        item.deletedAt = at;
      } else if (op.entity === "record") {
        const snapshot = s.snapshots.find((x) => x.date === id),
          history = s.history.filter((x) => x.date === id);
        const imported = s.assetHistory?.filter((x) => x.date === id) ?? [];
        if (!snapshot && !history.length && !imported.length)
          throw Error("삭제할 기록이 없습니다");
        push("record", id, { snapshot, history, assetHistory: imported });
        s.assetHistory = s.assetHistory?.filter((x) => x.date !== id);
        s.snapshots = s.snapshots.filter((x) => x.date !== id);
        s.history = s.history.filter((x) => x.date !== id);
        if (snapshot) refreshCurrent(s);
      } else {
        const row = s.audit.find((x) => x.id === id);
        if (!row) throw Error("삭제할 이력이 없습니다");
        push("audit", row.description, [row]);
        s.audit = s.audit.filter((x) => x.id !== id);
      }
    }
    if (op.entity === "asset" || op.entity === "loan")
      s = saveSnapshot(s, {
        date: dateNow(s),
        changes: {},
        revision: s.revision,
      });
  } else if (op.kind === "clearAudit") {
    push("audit", "수정 이력 전체", s.audit);
    s.audit = [];
  } else if (op.kind === "clearAll") {
    const saved = structuredClone(s);
    s = {
      ...s,
      assets: [],
      expenses: [],
      loans: [],
      snapshots: [],
      assetHistory: [],
      history: [],
      audit: [],
      trash: [],
      settings: { income: 0, annualIncome: 0, currency: "KRW" },
    };
    push("all", "전체 데이터", saved);
  } else {
    if (!("id" in op)) throw Error("잘못된 요청");
    const index = s.trash.findIndex((t) => t.id === op.id);
    if (index < 0) throw Error("휴지통 항목이 없습니다");
    const item = s.trash[index];
    if (op.kind === "restoreTrash") {
      if (item.entity === "all") {
        if (
          s.assets.length ||
          s.expenses.length ||
          s.loans.length ||
          s.snapshots.length ||
          s.history.length ||
          s.assetHistory?.length ||
          s.settings.income !== 0 ||
          s.settings.annualIncome !== 0
        )
          throw Error(
            "복원 충돌: 전체 복원은 현재 데이터가 비어 있을 때만 가능합니다. 현재 데이터를 먼저 백업하세요.",
          );
        const restored = stateSchema.parse(item.data);
        s = {
          ...restored,
          mode: original.mode,
          revision: original.revision,
          trash: [
            ...new Map(
              [
                ...(restored.trash ?? []),
                ...s.trash.filter((t) => t.id !== item.id),
              ].map((t) => [t.id, t]),
            ).values(),
          ],
        };
      } else if (item.entity === "record") {
        const data = item.data as {
          snapshot?: State["snapshots"][number];
          history: State["history"];
          assetHistory?: State["assetHistory"];
        };
        if (
          s.snapshots.some((x) => x.date === item.label) ||
          s.history.some((x) => x.date === item.label) ||
          s.assetHistory?.some((x) => x.date === item.label)
        )
          throw Error("같은 날짜의 기록이 있어 복원할 수 없습니다");
        if (data.snapshot) s.snapshots.push(data.snapshot);
        s.history.push(...data.history);
        if (data.assetHistory?.length)
          s.assetHistory = [
            ...(s.assetHistory ?? []),
            ...data.assetHistory,
          ].sort((a, b) => a.date.localeCompare(b.date));
        s.snapshots.sort((a, b) => a.date.localeCompare(b.date));
        s.history.sort((a, b) => a.date.localeCompare(b.date));
        if (data.snapshot) refreshCurrent(s);
      } else if (item.entity === "audit") {
        const rows = item.data as State["audit"];
        if (rows.some((row) => s.audit.some((x) => x.id === row.id)))
          throw Error("동일 이력이 있습니다");
        s.audit.unshift(...rows);
      } else {
        const key =
          item.entity === "asset"
            ? "assets"
            : item.entity === "expense"
              ? "expenses"
              : "loans";
        const data = item.data as State[typeof key][number];
        const existing = s[key].findIndex((x) => x.id === data.id);
        if (existing < 0 || !s[key][existing].deletedAt)
          throw Error("이미 복원했거나 충돌한 항목입니다");
        (s[key] as (typeof data)[])[existing] = data;
        if (item.entity === "asset" && data.active) {
          const a = s.assets.find((x) => x.id === data.id)!;
          s = saveSnapshot(s, {
            date: dateNow(s),
            changes: {},
            revision: s.revision,
          });
        } else if (item.entity === "loan")
          s = saveSnapshot(s, {
            date: dateNow(s),
            changes: {},
            revision: s.revision,
          });
      }
    } else if (item.entity === "asset") {
      const id = (item.data as { id: string }).id;
      purgeAssetReferences(s, id);
    } else if (item.entity === "expense")
      s.expenses = s.expenses.filter(
        (e) => e.id !== (item.data as { id: string }).id,
      );
    else if (item.entity === "loan")
      s.loans = s.loans.filter(
        (l) => l.id !== (item.data as { id: string }).id,
      );
    s.trash = s.trash?.filter((t) => t.id !== item.id);
  }
  s.revision = original.revision + 1;
  s.updatedAt = at;
  if (
    op.kind !== "clearAudit" &&
    op.kind !== "clearAll" &&
    !(op.kind === "delete" && op.entity === "audit")
  )
    s.audit.unshift({
      id: crypto.randomUUID(),
      at,
      description:
        op.kind === "delete"
          ? `${op.ids.length}개 항목 휴지통으로 이동`
          : op.kind === "restoreTrash"
            ? "휴지통 항목 복원"
            : "휴지통 항목 영구 삭제",
    });
  return stateSchema.parse(s);
}
export function applyUpdate(
  s: State,
  body: { revision: number; state: unknown; kind: string },
): State {
  if (body.revision !== s.revision)
    throw Error("저장 충돌: 최신 데이터를 다시 불러오세요");
  const desired = stateSchema.parse(body.state);
  if (body.kind === "restore") {
    if (s.mode !== "demo" && desired.mode === "demo")
      throw Error("실제 자료에 데모 백업을 덮어쓸 수 없습니다");
    return stateSchema.parse({
      ...desired,
      mode: s.mode,
      revision: s.revision + 1,
      updatedAt: new Date().toISOString(),
    });
  }
  if (desired.mode !== s.mode)
    throw Error("다른 데이터 모드의 저장은 허용하지 않습니다");
  if (
    s.assets.some((a) => !desired.assets.some((b) => b.id === a.id)) ||
    s.expenses.some((a) => !desired.expenses.some((b) => b.id === a.id)) ||
    s.loans.some((a) => !desired.loans.some((b) => b.id === a.id))
  )
    throw Error("항목 삭제는 삭제 기능을 사용하세요");
  let next = applyAssetEdits(
    {
      ...s,
      expenses: desired.expenses,
      loans: desired.loans,
      settings: desired.settings,
    },
    desired.assets,
  );
  if (JSON.stringify(s.loans) !== JSON.stringify(desired.loans))
    next = saveSnapshot(next, {
      date: dateNow(next),
      changes: {},
      revision: next.revision,
    });
  next.revision = s.revision + 1;
  next.updatedAt = new Date().toISOString();
  next.audit.unshift({
    id: crypto.randomUUID(),
    at: next.updatedAt,
    description: "자산·지출·설정 변경",
  });
  return stateSchema.parse(next);
}
