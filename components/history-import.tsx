"use client";
import { useState } from "react";
import { Button } from "./ui/button";
type Preview = {
  revision: number;
  dates: number;
  addedValues: number;
  conflicts: number;
  skippedTabs: number;
  unmatched: number;
  ambiguous: number;
};
export function HistoryImport({
  enabled,
  onImported,
}: {
  enabled: boolean;
  onImported: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function run(apply = false) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/history/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apply,
          revision: preview?.revision,
          requestId: crypto.randomUUID(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if (apply) {
        setPreview(null);
        setMessage(
          `${data.addedValues}개 과거 상세 값을 반영했습니다. 현재 잔액·평가일·분류는 유지됩니다.`,
        );
        await onImported();
      } else setPreview(data);
    } catch (error) {
      setMessage((error as Error).message);
      if (apply) setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel history-import-panel">
      <h2>과거 자산 상세 기록 가져오기</h2>
      <p>
        Google의 날짜 탭에서 정확히 대응되는 항목만 연결합니다. 총액을 자산별로
        나누거나 현재 잔액을 덮어쓰지 않습니다.
      </p>
      <Button
        variant="outline"
        disabled={!enabled || busy}
        onClick={() => run()}
      >
        {busy ? "확인 중" : "과거 기록 미리보기"}
      </Button>
      {!enabled && <p>Google 연결을 활성화한 뒤 이용할 수 있습니다.</p>}
      {preview && (
        <div className="history-import-preview">
          <b>
            {preview.dates}개 날짜 · 추가 가능한 상세 값 {preview.addedValues}개
          </b>
          <p>
            기존 값 우선 유지 {preview.conflicts}개 · 지원하지 않는 탭{" "}
            {preview.skippedTabs}개 · 대응 불명확/누락{" "}
            {preview.unmatched + preview.ambiguous}개
          </p>
          <Button
            disabled={busy || !preview.addedValues}
            onClick={() => run(true)}
          >
            과거 기록 반영
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setPreview(null)}
          >
            취소
          </Button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
