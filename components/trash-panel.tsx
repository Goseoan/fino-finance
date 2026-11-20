"use client";
import { State } from "@/lib/domain";
import { Trash2, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
export function TrashPanel({
  state,
  disabled,
  onRestore,
  onPurge,
  onClear,
  onAuditClear,
}: {
  state: State;
  disabled: boolean;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onClear: () => void;
  onAuditClear: () => void;
}) {
  return (
    <section className="panel trash-panel">
      <div className="panel-header">
        <div>
          <h2>휴지통과 데이터 삭제</h2>
          <p>
            삭제한 항목을 복원하거나 영구 삭제합니다. 원본 시트는 변경하지
            않습니다.
          </p>
        </div>
        <Trash2 size={19} />
      </div>
      <div className="trash-list">
        {state.trash?.length ? (
          state.trash.map((t) => (
            <div className="trash-row" key={t.id}>
              <div>
                <b>{t.label}</b>
                <small>
                  {
                    {
                      asset: "자산",
                      expense: "지출",
                      loan: "대출",
                      record: "날짜 기록",
                      audit: "수정 이력",
                      all: "전체 데이터",
                    }[t.entity]
                  }{" "}
                  · {new Date(t.deletedAt).toLocaleDateString("ko-KR")}
                </small>
              </div>
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() => onRestore(t.id)}
              >
                <RotateCcw size={13} />
                복원
              </Button>
              <Button
                variant="ghost"
                className="danger"
                disabled={disabled}
                onClick={() => onPurge(t.id)}
              >
                영구 삭제
              </Button>
            </div>
          ))
        ) : (
          <p className="empty">휴지통이 비어 있습니다.</p>
        )}
      </div>
      <div className="trash-actions">
        <Button
          variant="outline"
          disabled={disabled || !state.audit.length}
          onClick={onAuditClear}
        >
          수정 이력 전체 삭제
        </Button>
        <Button
          variant="outline"
          className="danger"
          disabled={disabled}
          onClick={onClear}
        >
          전체 데이터 삭제
        </Button>
      </div>
    </section>
  );
}
