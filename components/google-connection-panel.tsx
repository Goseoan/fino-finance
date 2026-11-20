"use client";
import { useEffect, useState } from "react";
import { Link2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
type Status = {
  configured: boolean;
  authorized: boolean;
  enabled: boolean;
  clientId: string;
  spreadsheetId: string;
  redirectUri: string;
  writeRange: string;
};
export function GoogleConnectionPanel({
  onConnected,
}: {
  onConnected?: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [clientId, setClientId] = useState(""),
    [secret, setSecret] = useState(""),
    [spreadsheetId, setSpreadsheetId] = useState(
      "",
    ),
    [redirect, setRedirect] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [approved, setApproved] = useState(false),
    [source, setSource] = useState("google");
  async function load() {
    try {
      const r = await fetch("/api/google/config");
      if (!r.ok) throw Error();
      const s = await r.json();
      setStatus(s);
      setClientId(s.clientId);
      if (s.spreadsheetId) setSpreadsheetId(s.spreadsheetId);
      setRedirect(`${location.origin}/api/google/callback`);
    } catch {
      setMessage("연결 설정을 읽지 못했습니다.");
    }
  }
  useEffect(() => {
    load();
    const result = new URLSearchParams(location.search).get("oauth");
    if (result)
      setMessage(
        result === "success"
          ? "Google 인증이 완료됐습니다. 아래에서 저장 범위를 확인하고 연결을 활성화하세요."
          : result === "failed"
            ? "인증이 취소되었거나 검증하지 못했습니다. 다시 로그인해 주세요."
            : "먼저 OAuth 클라이언트 설정을 저장해 주세요.",
      );
  }, []);
  async function configure(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/google/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          clientSecret: secret,
          spreadsheetId,
          redirectUri: redirect,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      setSecret("");
      setMessage("서버에 설정을 저장했습니다. Google 로그인을 진행하세요.");
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function connect() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/google/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, source }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      setMessage("실제 Google Sheets 연결과 저장 후 검증이 완료됐습니다.");
      await load();
      onConnected?.();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const locked = busy || !!status?.enabled;
  return (
    <section className="google-connection">
      <div className="connection-heading">
        <Link2 size={22} />
        <div>
          <h2>실제 Google Sheets 연결</h2>
          <p>
            {status?.enabled
              ? "Google에 읽기·쓰기 연결됨"
              : status?.authorized
                ? "인증 완료 · 저장소 활성화 대기"
                : "앱 전용 OAuth 인증이 필요합니다"}
          </p>
        </div>
        <span className={`tag ${status?.enabled ? "teal" : "amber"}`}>
          {status?.enabled ? "연결됨" : "미연결"}
        </span>
      </div>
      <div className="google-setup-note">
        <b>Google Cloud에 등록할 승인된 리디렉션 URI</b>
        <code>{redirect || "현재 앱 주소 확인 중"}</code>
        <p>
          Google Sheets API를 활성화하고 웹 애플리케이션 OAuth 클라이언트의
          테스트 사용자에 본인 계정을 추가하세요. 시크릿과 토큰은 서버 전용
          파일에 보관하며 다시 표시하지 않습니다. 연결 중인 설정은 먼저 연결을
          해제한 뒤 변경할 수 있습니다.
        </p>
        <a
          href="https://console.cloud.google.com/auth/clients"
          target="_blank"
          rel="noreferrer"
        >
          Google Cloud 클라이언트 설정 열기
        </a>
      </div>
      <form className="form" onSubmit={configure}>
        <label>
          Google 클라이언트 ID
          <input
            aria-label="Google 클라이언트 ID"
            value={clientId}
            disabled={locked}
            onChange={(e) => setClientId(e.target.value)}
            required
            autoComplete="off"
          />
        </label>
        <label>
          클라이언트 시크릿
          <input
            aria-label="Google 클라이언트 시크릿"
            type="password"
            value={secret}
            disabled={locked}
            onChange={(e) => setSecret(e.target.value)}
            required
            autoComplete="new-password"
            placeholder={
              status?.configured
                ? "설정을 변경할 때만 다시 입력"
                : "앱에만 입력하세요"
            }
          />
        </label>
        <label>
          저장할 복사본 스프레드시트 ID
          <input
            aria-label="Google 저장 대상 ID"
            value={spreadsheetId}
            disabled={locked}
            onChange={(e) => setSpreadsheetId(e.target.value)}
            required
          />
        </label>
        <div className="setting-actions compact-actions">
          <Button disabled={locked} type="submit">
            OAuth 설정 저장
          </Button>
          {status?.configured && !status.enabled && (
            <Button
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() => {
                location.href = "/api/google/auth";
              }}
            >
              Google 로그인
            </Button>
          )}
        </div>
      </form>
      <div className="google-scope">
        <h3>저장 범위 확인</h3>
        <p>
          동시 수정으로 데이터가 덮이지 않도록 이 앱 설치 하나에만 쓰기를
          허용합니다. 연결 시 앱 전용 탭에 쓰기 소유자 표식도 등록합니다.
        </p>
        <label className="connection-source">
          최초 연결 시 데이터
          <select
            aria-label="최초 연결 데이터"
            value={source}
            disabled={locked}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="google">Google 기존 자료 사용 (기본)</option>
            <option value="local">
              이 기기의 실제 작업본 업로드 (새 앱 저장소만)
            </option>
          </select>
        </label>
        <p>
          개선본의 <b>08_앱데이터!A1:D5000</b>에만 앱 상태를 기록합니다. 기존
          관리·날짜 탭과 원본 시트는 변경하지 않습니다. 저장 전 이 기기에 JSON
          백업을 만들고 저장 후 다시 읽어 검증합니다.
        </p>
        <p>
          Google 기존 자료를 선택하면 기존 앱 기록을 사용하거나 관리 탭을 읽어
          초기화합니다. 로컬 작업본 업로드는 새 앱 저장소에만 허용합니다. 연결
          전 로컬 변경도 별도로 백업합니다.
        </p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={approved}
            disabled={locked}
            onChange={(e) => setApproved(e.target.checked)}
          />
          위 저장 범위를 확인했습니다
        </label>
        <Button
          disabled={!status?.authorized || !approved || locked}
          onClick={connect}
        >
          {busy ? (
            <RefreshCw size={15} className="spin" />
          ) : (
            <CheckCircle2 size={15} />
          )}
          실제 저장소 연결
        </Button>
      </div>
      {message && (
        <p className="connection-result" role="status">
          <AlertCircle size={16} />
          {message}
        </p>
      )}
      <div className="setting-actions compact-actions">
        <Button variant="outline" onClick={load} disabled={busy}>
          연결 상태 새로고침
        </Button>
        {status?.configured && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              if (
                !confirm(
                  "Google 연결을 해제할까요? 구글 데이터는 삭제하지 않으며 마지막 확인 자료를 기기에 보관합니다.",
                )
              )
                return;
              setBusy(true);
              try {
                const r = await fetch("/api/google/disconnect", {
                  method: "POST",
                });
                if (!r.ok) throw Error("연결을 해제하지 못했습니다.");
                await load();
                onConnected?.();
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            연결 해제
          </Button>
        )}
      </div>
    </section>
  );
}
