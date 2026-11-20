"use client";
import { groupAssets } from "@/lib/classification";
import { MoneyInput } from "./ui/money-input";
import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  ChartNoAxesCombined,
  Plus,
  Trash2,
  Save,
  Undo2,
} from "lucide-react";
import { type Asset, type State, won, assetSchema } from "@/lib/domain";
import { Button } from "./ui/button";
export function AssetGrid({
  state,
  assets,
  categories,
  readOnly,
  busy,
  onSave,
  onDelete,
  onTrend,
  onEdit,
  onDirty,
}: {
  state: State;
  assets: Asset[];
  categories: string[];
  readOnly: boolean;
  busy: boolean;
  onSave: (assets: Asset[]) => Promise<void>;
  onDelete: (ids: string[]) => void;
  onTrend: (id: string) => void;
  onEdit: (asset: Asset) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Asset>>({}),
    [selected, setSelected] = useState<string[]>([]),
    [descending, setDescending] = useState(false),
    [error, setError] = useState("");
  const rows = useMemo(
    () =>
      groupAssets(assets).flatMap((g) =>
        descending ? [...g.items].sort((a, b) => b.value - a.value) : g.items,
      ),
    [assets, descending],
  );
  const groups = groupAssets(rows).map((g) => ({
    ...g,
    items: rows.filter((a) => g.items.some((item) => item.id === a.id)),
  }));
  const edited = Object.keys(drafts).length;
  const visibleSelected = selected.filter((id) =>
    assets.some((a) => a.id === id),
  );
  function patch(
    a: Asset,
    key: keyof Asset,
    value: string | number | boolean | null,
  ) {
    const next = {
      ...drafts,
      [a.id]: { ...(drafts[a.id] ?? a), [key]: value },
    };
    setDrafts(next);
    onDirty(true);
  }
  const valid = Object.values(drafts).every(
    (a) => assetSchema.safeParse(a).success,
  );
  async function save() {
    if (!valid) return;
    try {
      setError("");
      const changed = state.assets.map((a) => {
        const d = drafts[a.id];
        if (!d) return a;
        return {
          ...d,
          date:
            d.value !== a.value && d.date === a.date
              ? new Date().toLocaleDateString("en-CA", {
                  timeZone: "Asia/Seoul",
                })
              : d.date,
        };
      });
      await onSave(changed);
      setDrafts({});
      setSelected([]);
      onDirty(false);
    } catch {
      setError("저장하지 못했습니다. 수정한 값은 유지됩니다.");
    }
  }
  function cancel() {
    setDrafts({});
    onDirty(false);
    setError("");
  }
  return (
    <section className="panel asset-grid-panel">
      <div className="grid-toolbar">
        <div>
          <b>표에서 바로 수정하세요</b>
          <p>
            여러 행을 수정하고 한 번에 저장합니다. 평가액 수정 시 오늘 날짜로
            기록합니다.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={readOnly || busy || !visibleSelected.length || !!edited}
          onClick={() => onDelete(visibleSelected)}
        >
          <Trash2 size={14} />
          선택 {visibleSelected.length}개 삭제
        </Button>
      </div>
      <div className="asset-grid-scroll">
        <table className="asset-edit-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="자산 전체 선택"
                  disabled={readOnly || busy}
                  checked={
                    rows.length > 0 &&
                    rows.every((a) => selected.includes(a.id))
                  }
                  onChange={(e) =>
                    setSelected(e.target.checked ? rows.map((a) => a.id) : [])
                  }
                />
              </th>
              <th>자산명</th>
              <th>유형</th>
              <th>금융기관</th>
              <th>
                <button
                  aria-label="유형 내 평가액 순서 변경"
                  onClick={() => setDescending(!descending)}
                >
                  평가액 (원) <ArrowDownUp size={12} />
                </button>
              </th>
              <th>투자원금 (원)</th>
              <th>평가일</th>
              <th>활성</th>
              <th>관리</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.label}>
              <tr className="asset-grid-group">
                <th colSpan={9} scope="rowgroup">
                  <div>
                    <span>
                      {group.label}{" "}
                      <small>
                        {group.count}개 · 활성 {group.activeCount}개
                      </small>
                    </span>
                    <span>
                      저장된 활성 평가액 <b>{won(group.total)}원</b>
                    </span>
                  </div>
                </th>
              </tr>
              {group.items.map((a) => {
                const row = drafts[a.id] ?? a;
                return (
                  <tr key={a.id} className={drafts[a.id] ? "row-dirty" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${a.name} 선택`}
                        disabled={readOnly || busy}
                        checked={selected.includes(a.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, a.id]
                              : selected.filter((id) => id !== a.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`${a.name} 자산명`}
                        value={row.name}
                        disabled={readOnly || busy}
                        onChange={(e) => patch(a, "name", e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        aria-label={`${a.name} 유형`}
                        value={row.category}
                        disabled={readOnly || busy}
                        onChange={(e) => patch(a, "category", e.target.value)}
                      >
                        {categories.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label={`${a.name} 금융기관`}
                        value={row.institution}
                        disabled={readOnly || busy}
                        onChange={(e) =>
                          patch(a, "institution", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <MoneyInput
                        className="numeric"
                        aria-label={`${a.name} 그리드 평가액`}

                        min="0"
                        value={Number.isNaN(row.value) ? "" : row.value}
                        disabled={readOnly || busy}
                        onChange={(e) =>
                          patch(
                            a,
                            "value",
                            e.target.value === ""
                              ? NaN
                              : Number(e.target.value),
                          )
                        }
                      />
                      <small>
                        {won(Number.isNaN(row.value) ? 0 : row.value)}원
                      </small>
                    </td>
                    <td>
                      <MoneyInput
                        className="numeric"
                        aria-label={`${a.name} 그리드 투자원금`}

                        min="0"
                        value={row.principal ?? ""}
                        disabled={readOnly || busy}
                        onChange={(e) =>
                          patch(
                            a,
                            "principal",
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        aria-label={`${a.name} 그리드 평가일`}
                        value={row.date}
                        disabled={readOnly || busy}
                        onChange={(e) => patch(a, "date", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${a.name} 활성`}
                        checked={row.active}
                        disabled={readOnly || busy}
                        onChange={(e) => patch(a, "active", e.target.checked)}
                      />
                    </td>
                    <td>
                      <div className="grid-row-actions">
                        <button
                          className="icon-button ghost"
                          aria-label={`${a.name} 그리드 추이`}
                          onClick={() => onTrend(a.id)}
                        >
                          <ChartNoAxesCombined size={15} />
                        </button>
                        <button
                          className="icon-button danger"
                          disabled={readOnly || busy || !!edited}
                          aria-label={`${a.name} 그리드 삭제`}
                          onClick={() => onDelete([a.id])}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
        {!rows.length && (
          <div className="empty">
            표시할 자산이 없습니다. 자산 추가로 시작하세요.
          </div>
        )}
      </div>
      <div className="grid-save-footer">
        <div>
          <b>{edited ? `${edited}개 행 수정 중` : "저장하지 않은 변경 없음"}</b>
          <small>
            {visibleSelected.length}개 선택 · {assets.length}개 자산
          </small>
        </div>
        <Button variant="outline" disabled={!edited || busy} onClick={cancel}>
          <Undo2 size={14} />
          수정 취소
        </Button>
        <Button disabled={!edited || !valid || busy || readOnly} onClick={save}>
          <Save size={14} />
          {busy ? "저장 중" : "일괄 저장"}
        </Button>
      </div>
      {(!valid || error) && (
        <p className="error grid-error">
          {error || "자산명과 0 이상의 정수 금액을 확인하세요."}
        </p>
      )}
    </section>
  );
}
