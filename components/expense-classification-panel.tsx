"use client";
import { useEffect, useState } from "react";
import { type State, monthlyEquivalent, won } from "@/lib/domain";
import {
  CASHFLOW_CATEGORIES,
  CASHFLOW_HELP,
  classificationPreview,
  lastClassificationBatch,
} from "@/lib/expense-classification";
import { cashflowLabel } from "@/lib/classification";
import { expensePurpose } from "@/lib/expense-purpose";
import { Button } from "./ui/button";
export function ExpenseClassificationPanel({
  state,
  disabled,
  onSaved,
}: {
  state: State;
  disabled: boolean;
  onSaved: () => Promise<void>;
}) {
  const changes = classificationPreview(state),
    batch = lastClassificationBatch(state);
  const [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    setSelected([]);
  }, [state.revision]);
  async function run(undo = false) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/expenses/classification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: undo ? "undo" : "apply",
          revision: state.revision,
          ids: selected,
          batchId: batch,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setMessage(
        undo
          ? "분류만 되돌렸습니다. 금액과 다른 수정은 유지됩니다."
          : "분류를 정리하고 항목별 변경 이력을 저장했습니다.",
      );
      await onSaved();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const unclear = state.expenses.filter(
    (e) =>
      e.active &&
      !e.deletedAt &&
      ["검토 필요", "미분류"].includes(expensePurpose(e)),
  );
  return (
    <section
      className="panel classification-panel"
      aria-label="현금흐름 분류 점검"
    >
      <div className="panel-header">
        <div>
          <h2>현금흐름 분류 기준과 점검</h2>
          <p>현금흐름은 돈의 이동 성격, 세부 용도는 실제 사용처입니다.</p>
        </div>
      </div>
      <div className="classification-body">
        <p className="muted">
          보험·통신·세금·구독 등의 납부는 소비지출이 맞습니다. 같은 소비지출
          안에서도 아래 목록은 세부 용도별로 나누어 표시합니다. 예산 배정과 실제
          납부를 중복 등록하지 마세요.
        </p>
        <div className="classification-summary">
          {CASHFLOW_CATEGORIES.map((category) => {
            const items = state.expenses.filter(
              (e) => e.active && !e.deletedAt && e.category === category,
            );
            return (
              <details key={category}>
                <summary>
                  {cashflowLabel(category)} · {items.length}건
                  <strong>
                    {won(
                      items.reduce(
                        (sum, e) => sum + monthlyEquivalent(e.amount, e.cycle),
                        0,
                      ),
                    )}
                    원/월
                  </strong>
                </summary>
                <p>{CASHFLOW_HELP[category]}</p>
              </details>
            );
          })}
        </div>
        {changes.length > 0 && (
          <div>
            <h3>정정 가능한 분류 {changes.length}건</h3>
            <p className="muted">
              금액·사용 상태·세부 용도는 유지하고 선택한 항목의 현금흐름 분류만
              변경합니다.
            </p>
            {changes.map((c) => (
              <label className="classification-change" key={c.id}>
                <input
                  type="checkbox"
                  aria-label={`${c.name} 분류 정정 선택`}
                  checked={selected.includes(c.id)}
                  disabled={busy || disabled}
                  onChange={(e) =>
                    setSelected((ids) =>
                      e.target.checked
                        ? [...ids, c.id]
                        : ids.filter((id) => id !== c.id),
                    )
                  }
                />
                <span>
                  <b>{c.name}</b>
                  <span>
                    {cashflowLabel(c.before)} → {cashflowLabel(c.after)}
                  </span>
                  <small>{c.reason}</small>
                </span>
              </label>
            ))}
            <Button
              disabled={busy || disabled || !selected.length}
              onClick={() => run()}
            >
              선택한 {selected.length}건 분류 정정
            </Button>
          </div>
        )}
        {unclear.length > 0 && (
          <p className="muted">
            용도 추가 확인 {unclear.length}건:{" "}
            {unclear.map((e) => e.name).join(", ")}. 자동으로 분류를 바꾸지
            않았습니다.
          </p>
        )}
        {batch && (
          <Button
            disabled={busy || disabled}
            variant="outline"
            onClick={() => run(true)}
          >
            최근 분류 정비 되돌리기
          </Button>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </section>
  );
}
