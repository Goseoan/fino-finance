"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
type Status = {
  provider: string;
  revision: number;
  authorized: boolean;
  lastTransfer: { at: string; revision: number } | null;
};
type Preview = {
  localRevision: number;
  fingerprint: string | null;
  remoteRevision: number | null;
  counts: { assets: number; expenses: number; loans: number; audit: number };
};
export async function downloadExcel() {
  const response = await fetch("/api/export/excel", { cache: "no-store" });
  if (!response.ok) throw Error("엑셀 내보내기에 실패했습니다.");
  const url = URL.createObjectURL(await response.blob()),
    a = document.createElement("a");
  a.href = url;
  a.download = `fino-${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function StoragePanel({ revision }: { revision: number }) {
  const [status, setStatus] = useState<Status | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [operationId, setOperationId] = useState("");
  async function load() {
    try {
      const r = await fetch("/api/storage", { cache: "no-store" });
      if (!r.ok) throw Error();
      setStatus(await r.json());
    } catch {
      setMessage("로컬 저장 상태를 확인하지 못했습니다. 다시 열어 주세요.");
    }
  }
  useEffect(() => {
    void load();
    setPreview(null);
  }, [revision]);
  async function run(push = false) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/transfer/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          push
            ? {
                action: "push",
                approved: true,
                operationId,
                localRevision: preview?.localRevision,
                fingerprint: preview?.fingerprint,
              }
            : { action: "preview" },
        ),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      if (push) {
        setPreview(null);
        setMessage(
          "Google 전송과 다시 읽기 검증을 완료했습니다. 이후 변경은 다음 전송 전까지 로컬 DB에만 저장됩니다.",
        );
        await load();
      } else {
        setPreview(b);
        setOperationId(`manual-${crypto.randomUUID()}`);
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel google-connection" aria-label="저장 및 내보내기">
      <div className="connection-heading">
        <div>
          <h2>저장 및 내보내기</h2>
          <p>기본 저장소와 수동 내보내기를 관리합니다.</p>
        </div>
      </div>
      <p>
        <b>기본 저장소 · SQLite</b> · 조회와 수정은 이 기기의 DB에서 처리합니다.
        Google로 자동 전송하지 않습니다.
      </p>
      <div className="setting-actions compact-actions">
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await downloadExcel();
              setMessage("엑셀 파일을 내려받았습니다.");
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          엑셀로 내보내기 (.xlsx)
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => run()}>
          {busy ? "처리 중…" : "Google 전송 미리보기"}
        </Button>
      </div>
      <p className="muted">
        엑셀은 조회용 보고서입니다. 항목·이력·휴지통을 완전히 복원하려면 JSON
        백업을 보관하세요.
      </p>
      <p className="muted">
        Google에는 앱 전용 08_앱데이터 탭에 전체 복원용 데이터(A:D)와 읽기 쉬운
        표(F:R)를 보냅니다. 기존 관리·날짜 탭은 유지합니다. 이 화면에서 전송할
        때만 Google에 접속합니다.
      </p>
      {status?.lastTransfer && (
        <p>
          마지막 전송:{" "}
          {new Date(status.lastTransfer.at).toLocaleString("ko-KR")} ·{" "}
          {status.lastTransfer.revision === revision
            ? "현재 버전 전송됨"
            : "전송 후 로컬 변경 있음"}
        </p>
      )}
      {preview && (
        <div className="google-scope">
          <h3>Google 전송 범위 확인</h3>
          <p>
            자산 {preview.counts.assets}개 · 고정지출 {preview.counts.expenses}
            개 · 대출 {preview.counts.loans}개 · 수정 이력{" "}
            {preview.counts.audit}개
          </p>
          <p>
            자산·지출·대출의 과거 잔액·분류·설정·휴지통도 포함합니다. 급여명세서와 사진은 급여 메뉴의 별도 백업을 사용하세요.{" "}
            {preview.remoteRevision === null
              ? "새 앱 보관본을 만듭니다."
              : "Google의 기존 앱 보관본을 현재 로컬 자료로 교체합니다. 교체 전 보관본은 이 기기에 백업합니다."}{" "}
            전송 후 다시 읽어 검증합니다.
          </p>
          <Button disabled={busy} onClick={() => run(true)}>
            확인한 자료 Google로 전송
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
