"use client";
import {
  ASSET_TYPES,
  orderedLabels,
  classificationLabel,
  groupAssets,
} from "@/lib/classification";
import { HistoryImport } from "./history-import";
import { CASH_TYPES, cashType, groupCashAssets } from "@/lib/cash-types";
import { MoneyInput } from "./ui/money-input";
import { formatMoneyInput } from "@/lib/money-input";
import { useEffect, useState, useRef } from "react";
import {
  LayoutDashboard,
  Wallet,
  ChartNoAxesCombined,
  ArrowLeftRight,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  ChevronDown,
  Bell,
  Sun,
  Moon,
  Menu,
  X,
  Check,
  CalendarDays,
  RefreshCw,
  Landmark,
  ShieldCheck,
  Info,
  Download,
  Search,
  TrendingUp,
  ReceiptText,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  Upload,
  LogOut,
  Trash2,
  LayoutGrid,
  Table2,
} from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  type Asset,
  type Expense,
  type Loan,
  type State,
  assetSchema,
  expenseSchema,
  stateSchema,
  totals,
  cashflow,
  won,
  compact,
  timeline,
  scheduledOutflow,
  amortization,
  monthlyEquivalent,
  loanMonthly,
  payment,
} from "@/lib/domain";
import { Button } from "./ui/button";
import { LoanEditor } from "./loan-editor";
import { TrendChart, Composition, palette } from "./charts";
import { Panel } from "./ui/panel";
import { Modal } from "./ui/modal";
import { AssetForm, ExpenseForm } from "./editor-forms";
import { Dashboard } from "./dashboard";
import { AssetTrend } from "./asset-trend";
import { AssetGrid } from "./asset-grid";
import { TrashPanel } from "./trash-panel";
import { GoogleConnectionPanel } from "./google-connection-panel";
import type { DeleteEntity } from "@/lib/mutations";
import { ExpenseTable } from "./expense-table";
const sections = [
  { name: "대시보드", icon: LayoutDashboard },
  { name: "오늘의 자산 등록", icon: Plus },
  { name: "자산 관리", icon: Wallet },
  { name: "고정지출", icon: ReceiptText },
  { name: "대출 관리", icon: Landmark },
  { name: "이력 및 통계", icon: ChartNoAxesCombined },
  { name: "설정", icon: Settings },
];
export default function FinanceApp() {
  const [state, setState] = useState<State | null>(null);
  const [demo, setDemo] = useState<State | null>(null);
  const [section, setSection] = useState("대시보드");
  const [dark, setDark] = useState(false);
  const [menu, setMenu] = useState(false);
  const [period, setPeriod] = useState("1년");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [editor, setEditor] = useState<
    | { kind: "asset"; value?: Asset }
    | { kind: "expense"; value?: Expense }
    | { kind: "loan"; value?: Loan }
    | null
  >(null);
  const [date, setDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }),
  );
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState(false);
  const [rate, setRate] = useState("4.3");
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [assetFilter, setAssetFilter] = useState<string | null>(null);
  const [cashFilter, setCashFilter] = useState("");
  const [query, setQuery] = useState("");
  const [trendId, setTrendId] = useState<string | null>(null);
  const [oauth, setOauth] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [view, setView] = useState<"cards" | "grid">("cards");
  const [gridDirty, setGridDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    title: string;
    description: string;
    body: Record<string, unknown>;
  } | null>(null);
  const requestRef = useRef<{ key: string; id: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<State | null>(null);
  const readOnly = state?.mode === "imported";
  const dirty = Object.keys(changes).length > 0 || gridDirty;
  useEffect(() => {
    const theme = localStorage.getItem("fino-theme");
    setDark(theme === "dark");
    if (localStorage.getItem("fino-asset-view") === "grid") setView("grid");
    load();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("fino-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/state");
      if (!r.ok)
        throw Error("데이터를 불러오지 못했습니다. 다시 시도해 주세요.");
      const s = stateSchema.parse(await r.json());
      setState(s);
      setDemo(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  function navigate(next: string) {
    if (
      dirty &&
      next !== section &&
      !window.confirm("저장하지 않은 변경사항을 취소하고 이동할까요?")
    )
      return;
    if (next !== section) {
      setChanges({});
      setGridDirty(false);
    }
    setSection(next);
    setMenu(false);
    setQuery("");
  }
  function requestId(kind: string, payload: unknown) {
    const key = JSON.stringify([state?.revision, kind, payload]);
    if (requestRef.current?.key !== key)
      requestRef.current = { key, id: crypto.randomUUID() };
    return requestRef.current.id;
  }
  function requestDelete(entity: DeleteEntity, ids: string[], label: string) {
    setEditor(null);
    setPendingAction({
      title: `${label} 삭제`,
      description:
        (entity === "asset"
          ? "선택한 자산을 휴지통으로 이동하고 현재 합계에서 제외합니다. 과거 기록은 보존하며 휴지통에서 복원할 수 있습니다."
          : entity === "record"
            ? "이 날짜의 스냅샷과 집계 기록을 함께 휴지통으로 이동합니다. 최신 기록이면 직전 상세 기록의 잔액으로 되돌립니다."
            : "선택한 항목을 휴지통으로 이동합니다. 복원할 수 있습니다.") +
        "\n\n대상: " +
        (entity === "asset"
          ? state?.assets
              .filter((a) => ids.includes(a.id))
              .map((a) => a.name)
              .join(", ")
          : entity === "expense"
            ? state?.expenses
                .filter((a) => ids.includes(a.id))
                .map((a) => a.name)
                .join(", ")
            : entity === "loan"
              ? state?.loans
                  .filter((a) => ids.includes(a.id))
                  .map((a) => a.name)
                  .join(", ")
              : ids.join(", ")),
      body: { kind: "delete", entity, ids, requestId: crypto.randomUUID() },
    });
  }
  async function performAction() {
    if (!pendingAction || !state) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pendingAction.body,
          revision: state.revision,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      setState(stateSchema.parse(b));
      setDemo(b);
      setPendingAction(null);
      setGridDirty(false);
      setChanges({});
      setToast("데이터 변경을 저장했습니다.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function persist(next: State, kind = "update") {
    if (readOnly) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          revision: state!.revision,
          state: next,
          requestId: requestId(kind, next),
        }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      setState(body);
      setDemo(body);
      setToast("변경사항을 안전하게 저장했습니다.");
      setEditor(null);
      setConfirmRestore(null);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "snapshot",
          requestId: requestId("snapshot", { date, changes }),
          date,
          revision: state!.revision,
          changes: Object.fromEntries(
            Object.entries(changes).map(([id, v]) => [id, Number(v)]),
          ),
        }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      setState(body);
      setDemo(body);
      setChanges({});
      setPreview(false);
      setToast("자산 기록을 저장했습니다. 대시보드에 반영되었습니다.");
    } catch (e) {
      setError((e as Error).message);
      setPreview(false);
    } finally {
      setBusy(false);
    }
  }
  async function importSource() {
    if (dirty) return;
    setBusy(true);
    try {
      const r = await fetch("/api/imported");
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      setState(stateSchema.parse(body));
      setToast("시트 보관본을 읽기 전용으로 열었습니다.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fino-${state?.mode}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("JSON 백업을 내보냈습니다.");
  }
  if (!state)
    return (
      <main className="loading-screen">
        <span className="brand-logo">f</span>
        <h1>나의 금융 생활을 준비하고 있어요</h1>
        {loading ? (
          <RefreshCw className="spin" />
        ) : (
          <>
            <p role="alert">{error}</p>
            <Button onClick={load}>다시 시도</Button>
            <Button
              variant="outline"
              onClick={() => {
                location.href = "/connect";
              }}
            >
              Google 연결 설정
            </Button>
          </>
        )}
      </main>
    );
  const t = totals(state),
    cf = cashflow(state),
    scheduled = scheduledOutflow(
      state,
      new Date()
        .toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })
        .slice(0, 7),
    );
  const records = timeline(state);
  const previous = records.at(-2);
  const delta = previous ? t.net - (previous.assets - previous.debt) : 0;
  const changePct =
    previous && previous.assets !== previous.debt
      ? (delta / Math.abs(previous.assets - previous.debt)) * 100
      : 0;
  const baseline = state.snapshots.filter((s) => s.date <= date).at(-1);
  const baseValues =
    baseline?.values ??
    Object.fromEntries(state.assets.map((a) => [a.id, a.value]));
  const categories = [
    ...new Set([
      ...(state.settings.assetCategories ?? [
        "현금",
        "투자",
        "연금",
        "부동산",
        "기타",
      ]),
      ...state.assets.filter((a) => !a.deletedAt).map((a) => a.category),
    ]),
  ];
  const assetTypeLabels = orderedLabels(categories, ASSET_TYPES);
  const cashTypeLabels = orderedLabels(
    [
      ...CASH_TYPES,
      ...state.assets
        .filter(
          (a) => !a.deletedAt && classificationLabel(a.category) === "현금",
        )
        .map(cashType),
    ],
    CASH_TYPES,
  );
  const visibleAssets = state.assets.filter(
    (a) =>
      !a.deletedAt &&
      (assetFilter === null ||
        classificationLabel(a.category) === assetFilter) &&
      (!cashFilter ||
        (classificationLabel(a.category) === "현금" &&
          cashType(a) === cashFilter)) &&
      (a.name + " " + a.institution)
        .toLocaleLowerCase("ko-KR")
        .includes(query.trim().toLocaleLowerCase("ko-KR")),
  );
  const assetGroups = groupAssets(visibleAssets);
  const sourceLabel =
    state.mode === "sheets"
      ? "Google 연동"
      : state.mode === "local"
        ? "실제 자료 · 미연결"
        : state.mode === "imported"
          ? "시트 보관본"
          : "데모 모드";
  const activeAssets = state.assets.filter((a) => a.active);
  const ordered = activeAssets.slice().sort((a, b) => b.value - a.value);
  const selectedLoan =
    state.loans.find((l) => l.active && l.id === selectedLoanId) ??
    state.loans.find((l) => l.active);
  const dsr = state.settings.annualIncome
    ? ((cf.loan * 12) / state.settings.annualIncome) * 100
    : null;
  const validChanges = Object.values(changes).every(
    (v) => v !== "" && Number.isSafeInteger(Number(v)) && Number(v) >= 0,
  );
  const changeSum = Object.entries(changes).reduce(
    (s, [id, v]) => s + (Number(v) || 0) - (baseValues[id] ?? 0),
    0,
  );
  const latestDate = state.snapshots.at(-1)?.date ?? state.assets[0]?.date;
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <AnimatePresence>
          {menu && (
            <motion.div
              className="sidebar-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenu(false)}
            />
          )}
        </AnimatePresence>
        <aside className={`sidebar ${menu ? "is-open" : ""}`}>
          <a
            href="#"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              navigate("대시보드");
            }}
          >
            <span className="brand-logo">f</span>
            <span>
              fin:o<span className="brand-dot">.</span>
            </span>
          </a>
          <div className="workspace">
            <span className="workspace-icon">
              <Wallet size={18} />
            </span>
            <div>
              <b>나의 금융 생활</b>
              <small>Personal workspace</small>
            </div>
            <ChevronDown size={14} />
          </div>
          <div className="nav-caption">내 자산</div>
          <nav>
            {sections.slice(0, 6).map(({ name, icon: Icon }, i) => (
              <button
                key={name}
                onClick={() => navigate(name)}
                className={`nav-item ${section === name ? "active" : ""}`}
                aria-current={section === name ? "page" : undefined}
              >
                <Icon size={19} />
                <span>{name}</span>
                {i === 1 && (
                  <span className="nav-new" aria-hidden="true">
                    N
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <ShieldCheck size={20} />
              <b>차곡차곡, 더 나은 내일</b>
              <p>
                작은 기록이 모여
                <br />
                든든한 자산이 됩니다.
              </p>
              <span>
                나만의 금융 루틴 <ArrowUpRight size={13} />
              </span>
            </div>
            <button
              className={`nav-item ${section === "설정" ? "active" : ""}`}
              onClick={() => navigate("설정")}
            >
              <Settings size={19} />
              설정
            </button>
            <div className="profile">
              <span className="avatar">나</span>
              <div>
                <b>나의 워크스페이스</b>
                <small>{sourceLabel}</small>
              </div>
              <span className="profile-status" />
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                aria-label="메뉴 열기"
                className="icon-button ghost mobile-menu"
                onClick={() => setMenu(true)}
              >
                <Menu size={21} />
              </button>
              <span>내 자산</span>
              <ChevronRight size={13} />
              <b>{section}</b>
            </div>
            <div className="topbar-actions">
              <span className="connection-pill">
                <i />
                {sourceLabel}
              </span>
              {state.mode === "sheets" && (
                <button
                  className="icon-button ghost"
                  aria-label="Google 데이터 새로고침"
                  disabled={busy}
                  onClick={() => {
                    if (
                      dirty &&
                      !confirm(
                        "수정 내용을 취소하고 Google 데이터를 새로 읽을까요?",
                      )
                    )
                      return;
                    setGridDirty(false);
                    setChanges({});
                    setView("cards");
                    void load();
                  }}
                >
                  <RefreshCw size={16} />
                </button>
              )}
              <span className="top-divider" />
              <button
                className="icon-button ghost"
                aria-label={dark ? "라이트 모드" : "다크 모드"}
                onClick={() => setDark(!dark)}
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                className="icon-button ghost notification-button"
                aria-label="알림 확인"
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={18} />
                <i />
              </button>
              <span className="avatar small">나</span>
            </div>
          </header>
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-eyebrow">
                  {section === "대시보드"
                    ? "MY FINANCIAL OVERVIEW"
                    : "MY FINANCIAL WORKSPACE"}
                </div>
                <h1>
                  {section === "대시보드" ? "나의 자산, 한눈에" : section}
                </h1>
                <p>
                  {section === "대시보드"
                    ? "흩어져 있는 자산을 모아, 더 명확한 내일을 준비하세요."
                    : section === "오늘의 자산 등록"
                      ? "달라진 금액만 입력하면, 오늘의 기록이 완성돼요."
                      : section === "고정지출"
                        ? "매달 나가는 돈을 정리하고, 현금흐름을 계획하세요."
                        : section === "대출 관리"
                          ? "상환 계획부터 금리 변화까지, 차분하게 확인하세요."
                          : "작은 기록에서 시작하는 나만의 금융 루틴"}
                </p>
              </div>
              <div className="heading-actions">
                {section === "대시보드" ? (
                  <>
                    <Button variant="outline" onClick={exportData}>
                      <Download size={16} />
                      <span>내보내기</span>
                    </Button>
                    <Button
                      onClick={() => navigate("오늘의 자산 등록")}
                      disabled={readOnly}
                    >
                      <Plus size={17} />
                      자산 기록하기
                    </Button>
                  </>
                ) : section === "대출 관리" ? (
                  <Button
                    disabled={readOnly}
                    onClick={() => setEditor({ kind: "loan" })}
                  >
                    <Plus size={16} />
                    대출 추가
                  </Button>
                ) : section === "자산 관리" ? (
                  <Button
                    disabled={readOnly}
                    onClick={() => setEditor({ kind: "asset" })}
                  >
                    <Plus size={16} />
                    자산 추가
                  </Button>
                ) : (
                  <span className="date-chip">
                    <CalendarDays size={15} />
                    {latestDate?.replaceAll("-", ". ")}
                  </span>
                )}
              </div>
            </div>
            <div className={`data-banner ${readOnly ? "warning" : ""}`}>
              <Info size={16} />
              <span>
                {readOnly ? (
                  <>
                    <b>읽기 전용 · 과거 기록</b>
                    <span className="banner-detail">
                      {" "}
                      탭 {state.history.at(-1)?.date} / 원본 기준일{" "}
                      {state.history.at(-1)?.sourceDate} · 현재 잔액이 아닙니다.
                    </span>
                  </>
                ) : (
                  <>
                    <b>
                      {state.mode === "demo"
                        ? "데모 데이터로 둘러보고 있어요."
                        : state.mode === "sheets"
                          ? "실제 Google Sheets에 연결되어 있습니다."
                          : "실제 자료의 로컬 작업본 · Google 미연결"}
                    </b>
                    <span className="banner-detail">
                      {" "}
                      {state.mode === "sheets"
                        ? "변경사항은 앱 전용 탭에 저장 후 검증합니다."
                        : state.mode === "local"
                          ? "변경사항은 이 기기에만 저장됩니다. Google 연결을 완료해 주세요."
                          : "입력한 내용은 이 기기의 로컬 서버에 저장됩니다."}
                    </span>
                  </>
                )}
              </span>
              <button onClick={() => navigate("설정")}>
                {readOnly ? "연결 확인" : "데이터 연결"}
                <ArrowRight size={13} />
              </button>
            </div>
            {error && !pendingAction && (
              <div className="error-banner" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
                <button onClick={() => setError("")} aria-label="오류 닫기">
                  <X size={16} />
                </button>
              </div>
            )}
            {section === "대시보드" && (
              <Dashboard
                state={state}
                period={period}
                setPeriod={setPeriod}
                navigate={navigate}
              />
            )}
            {section === "오늘의 자산 등록" && (
              <>
                <div className="entry-controls panel">
                  <div>
                    <CalendarDays size={20} />
                    <label>
                      자산 기준일
                      <input
                        type="date"
                        aria-label="자산 기준일"
                        value={date}
                        onChange={(e) => {
                          if (
                            dirty &&
                            !window.confirm(
                              "변경사항을 취소하고 날짜를 바꿀까요?",
                            )
                          )
                            return;
                          setDate(e.target.value);
                          setChanges({});
                        }}
                      />
                    </label>
                  </div>
                  <span>
                    {baseline
                      ? `직전 기록 ${baseline.date}`
                      : "이전 기록 없음 · 현재 목록 초기값"}
                    <small>변경하지 않은 잔액은 이월값으로 저장합니다.</small>
                  </span>
                </div>
                <Panel
                  title="오늘의 잔액을 확인해 주세요"
                  subtitle="변경된 항목만 입력하세요. 확인한 항목은 저장 후 평가일이 갱신됩니다."
                  action={
                    <span className="tag teal">
                      {Object.keys(changes).length}개 변경
                    </span>
                  }
                >
                  <div className="entry-list">
                    {activeAssets.map((a) => {
                      const value =
                        changes[a.id] ?? String(baseValues[a.id] ?? a.value);
                      const changed = a.id in changes;
                      return (
                        <div
                          className={`entry-row ${changed ? "changed" : ""}`}
                          key={a.id}
                        >
                          <span className="asset-type-icon">
                            <Wallet size={18} />
                          </span>
                          <div className="entry-name">
                            <b>{a.name}</b>
                            <small>
                              {a.institution} · {a.category}
                            </small>
                            <small>평가일 {a.date}</small>
                          </div>
                          <div className="entry-prior">
                            <small>이전 기록</small>
                            <b>{won(baseValues[a.id] ?? a.value)}원</b>
                          </div>
                          <div className="amount-input">
                            <MoneyInput
                              aria-label={`${a.name} 평가액`}

                              min="0"
                              step="1"
                              disabled={readOnly}
                              value={value}
                              onChange={(e) => {
                                const v = e.target.value;
                                setChanges((c) => {
                                  const next = { ...c };
                                  if (v === String(baseValues[a.id] ?? a.value))
                                    delete next[a.id];
                                  else next[a.id] = v;
                                  return next;
                                });
                              }}
                            />
                            <span>원</span>
                            {changed && (
                              <small className="positive">
                                {Number(value) -
                                  (baseValues[a.id] ?? a.value) >=
                                0
                                  ? "+"
                                  : ""}
                                {won(
                                  Number(value) - (baseValues[a.id] ?? a.value),
                                )}
                                원
                              </small>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
                <div className="save-bar">
                  <div>
                    <b>
                      {dirty
                        ? `${Object.keys(changes).length}개 자산이 변경되었어요`
                        : "변경된 자산이 없습니다"}
                    </b>
                    <span>
                      총 증감 {changeSum >= 0 ? "+" : ""}
                      {won(changeSum)}원
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    disabled={!dirty || busy}
                    onClick={() => setChanges({})}
                  >
                    수정 취소
                  </Button>
                  <Button
                    disabled={
                      !dirty || !validChanges || !date || busy || readOnly
                    }
                    onClick={() => setPreview(true)}
                  >
                    변경사항 확인 <ArrowRight size={15} />
                  </Button>
                </div>
                {!validChanges && (
                  <p className="error">금액은 0 이상의 정수로 입력해 주세요.</p>
                )}
              </>
            )}
            {section === "자산 관리" && (
              <>
                <div className="stat-row">
                  <div>
                    <span>전체 자산</span>
                    <strong>
                      {won(t.assets)}
                      <small>원</small>
                    </strong>
                  </div>
                  <div>
                    <span>활성 계좌</span>
                    <strong>
                      {activeAssets.length}
                      <small>개</small>
                    </strong>
                  </div>
                  <div>
                    <span>직전 기록 대비</span>
                    <strong className="positive">
                      {delta >= 0 ? "+" : ""}
                      {won(delta)}
                      <small>원</small>
                    </strong>
                  </div>
                </div>
                <div className="asset-toolbar">
                  <div className="view-switch" aria-label="자산 보기 방식">
                    <button
                      className={view === "cards" ? "selected" : ""}
                      aria-pressed={view === "cards"}
                      onClick={() => {
                        if (
                          gridDirty &&
                          !confirm("그리드 변경을 취소하고 카드로 전환할까요?")
                        )
                          return;
                        setGridDirty(false);
                        setView("cards");
                        localStorage.setItem("fino-asset-view", "cards");
                      }}
                    >
                      <LayoutGrid size={15} />
                      카드 보기
                    </button>
                    <button
                      className={view === "grid" ? "selected" : ""}
                      aria-pressed={view === "grid"}
                      onClick={() => {
                        setView("grid");
                        localStorage.setItem("fino-asset-view", "grid");
                      }}
                    >
                      <Table2 size={15} />
                      그리드 보기
                    </button>
                  </div>
                </div>
                <div className="asset-toolbar">
                  <div className="filter-tabs">
                    {[null, ...assetTypeLabels].map((x) => (
                      <button
                        key={x === null ? "all-types" : `type-${x}`}
                        onClick={() => {
                          setAssetFilter(x);
                          if (x !== null && x !== "현금") setCashFilter("");
                        }}
                        aria-pressed={assetFilter === x}
                        className={assetFilter === x ? "selected" : ""}
                      >
                        {x === null
                          ? "전체"
                          : x === "전체"
                            ? "전체 (사용자 유형)"
                            : x}
                      </button>
                    ))}
                  </div>
                  <select
                    aria-label="현금 세부 유형 필터"
                    value={cashFilter}
                    disabled={assetFilter !== null && assetFilter !== "현금"}
                    onChange={(e) => setCashFilter(e.target.value)}
                  >
                    <option value="">모든 현금 세부 유형</option>
                    {cashTypeLabels.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                  <div className="search-field">
                    <Search size={16} />
                    <input
                      placeholder="자산명 또는 금융기관 검색"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>
                {view === "grid" ? (
                  <AssetGrid
                    key={`${state.mode}-${state.revision}`}
                    state={state}
                    assets={visibleAssets}
                    categories={categories}
                    readOnly={readOnly}
                    busy={busy}
                    onSave={async (assets) => {
                      await persist({ ...state, assets });
                    }}
                    onDelete={(ids) =>
                      requestDelete("asset", ids, `${ids.length}개 자산`)
                    }
                    onTrend={setTrendId}
                    onEdit={(value) => setEditor({ kind: "asset", value })}
                    onDirty={setGridDirty}
                  />
                ) : (
                  <div className="asset-groups">
                    {assetGroups.map((group) => (
                      <section
                        key={group.label}
                        className="asset-type-group"
                        aria-label={`${group.label} 자산 그룹`}
                      >
                        <h2 className="asset-group-heading">
                          <span>
                            {group.label}{" "}
                            <small>
                              {group.count}개 · 활성 {group.activeCount}개
                            </small>
                          </span>
                          <span>
                            활성 평가액 <b>{won(group.total)}원</b>
                          </span>
                        </h2>
                        {(group.label === "현금"
                          ? groupCashAssets(group.items)
                          : [
                              {
                                label: "",
                                items: group.items,
                                count: group.count,
                                total: group.total,
                              },
                            ]
                        ).map((subgroup) => (
                          <div key={subgroup.label || group.label}>
                            {subgroup.label && (
                              <h3 className="cash-group-heading">
                                {subgroup.label}{" "}
                                <small>
                                  {subgroup.count}개 · 활성 평가액{" "}
                                  {won(subgroup.total)}원
                                </small>
                              </h3>
                            )}
                            <div className="asset-grid">
                              {subgroup.items.map((a, i) => (
                                <article
                                  key={a.id}
                                  className={`asset-card panel ${!a.active ? "inactive" : ""}`}
                                >
                                  <div className="asset-card-top">
                                    <span className={`bank-icon bank-${i % 3}`}>
                                      {a.institution.slice(0, 1) || "자"}
                                    </span>
                                    <span className="tag">
                                      {classificationLabel(a.category)} ·{" "}
                                      {a.active ? "활성" : "비활성"}
                                    </span>
                                  </div>
                                  {group.label === "현금" ? (
                                    <h4>{a.name}</h4>
                                  ) : (
                                    <h3>{a.name}</h3>
                                  )}
                                  {group.label === "현금" && (
                                    <p className="cash-type-note">
                                      {cashType(a)} ·{" "}
                                      {a.cashType
                                        ? "직접 지정"
                                        : "이름 기반 제안"}
                                    </p>
                                  )}
                                  <p>{a.institution}</p>
                                  <strong>
                                    {won(a.value)}
                                    <small>원</small>
                                  </strong>
                                  <div className="asset-card-footer">
                                    <span>
                                      {a.principal !== null
                                        ? `평가손익 ${a.value - a.principal >= 0 ? "+" : ""}${won(a.value - a.principal)}원`
                                        : "투자원금 미입력"}
                                    </span>
                                    <span>
                                      {a.principal !== null && a.principal > 0
                                        ? `${((a.value / a.principal - 1) * 100).toFixed(1)}%`
                                        : "—"}
                                    </span>
                                  </div>
                                  <div className="asset-date">
                                    {a.date} 평가 ·{" "}
                                    {readOnly ? "읽기 전용" : "수기 기록"}
                                  </div>
                                  <div className="asset-card-actions">
                                    <Button
                                      variant="outline"
                                      onClick={() => setTrendId(a.id)}
                                      aria-label={`${a.name} 변경 추이`}
                                    >
                                      <ChartNoAxesCombined size={15} />
                                      변경 추이
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      className="danger"
                                      disabled={readOnly || busy}
                                      aria-label={`${a.name} 자산 삭제`}
                                      onClick={() =>
                                        requestDelete("asset", [a.id], a.name)
                                      }
                                    >
                                      <Trash2 size={15} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      disabled={readOnly}
                                      onClick={() =>
                                        setEditor({ kind: "asset", value: a })
                                      }
                                      aria-label={`${a.name} 자산 수정`}
                                    >
                                      수정
                                    </Button>
                                  </div>
                                </article>
                              ))}
                            </div>
                          </div>
                        ))}
                      </section>
                    ))}
                    {!visibleAssets.length && (
                      <div className="panel empty">
                        일치하는 자산이 없습니다. 검색어나 유형 필터를
                        확인하세요.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {section === "고정지출" && (
              <>
                <div className="stat-row">
                  <div>
                    <span>월 환산 배정·지출</span>
                    <strong>
                      {won(cf.budget)}
                      <small>원</small>
                    </strong>
                  </div>
                  <div>
                    <span>소비지출 월 환산</span>
                    <strong>
                      {won(cf.consumption)}
                      <small>원</small>
                    </strong>
                  </div>
                  <div>
                    <span>급여 사전공제 (별도)</span>
                    <strong>
                      {won(
                        state.expenses
                          .filter((e) => e.active && e.category === "급여공제")
                          .reduce(
                            (s, e) => s + monthlyEquivalent(e.amount, e.cycle),
                            0,
                          ),
                      )}
                      <small>원</small>
                    </strong>
                  </div>
                </div>
                <div className="scheduled-summary panel">
                  <CalendarDays size={20} />
                  <div>
                    <b>이번 달 납부일 기준 계획 현금유출</b>
                    <p>
                      월 환산 예산과 별도 계산 · 납부일 미확인{" "}
                      {scheduled.unknown}건 제외
                    </p>
                  </div>
                  <strong>
                    {won(scheduled.scheduled)}
                    <small>원</small>
                  </strong>
                </div>
                <ExpenseTable
                  expenses={state.expenses.filter((e) => !e.deletedAt)}
                  onDelete={(e) => requestDelete("expense", [e.id], e.name)}
                  onInline={async (e) => {
                    await persist({
                      ...state,
                      expenses: state.expenses.map((x) =>
                        x.id === e.id ? e : x,
                      ),
                    });
                  }}
                  readOnly={!!readOnly}
                  onEdit={(value) => setEditor({ kind: "expense", value })}
                />
                <div className="info-note">
                  <Info size={16} />
                  <p>
                    생활비예산은 실사용액이 아닙니다. 저축·투자는 자금 배정,
                    급여공제는 통장 입금 전 금액으로 소비와 구분합니다.
                    대출상환은 대출 목록에서 한 번만 집계합니다. 연·분기 납부의
                    실제 납부월은 확인이 필요합니다.
                  </p>
                </div>
              </>
            )}
            {section === "대출 관리" && (
              <>
                <div className="stat-row">
                  <div>
                    <span>남은 대출 원금</span>
                    <strong>
                      {won(t.debt)}
                      <small>원</small>
                    </strong>
                  </div>
                  <div>
                    <span>예상 월 원리금</span>
                    <strong>
                      {won(cf.loan)}
                      <small>원</small>
                    </strong>
                  </div>
                  <div>
                    <span>간이 DSR / 40% 한도 사용률</span>
                    <strong>
                      {dsr === null ? "—" : dsr.toFixed(1)}
                      <small>
                        % / {dsr === null ? "—" : ((dsr / 40) * 100).toFixed(1)}
                        %
                      </small>
                    </strong>
                  </div>
                </div>
                <div className="loan-choice">
                  <label>
                    분석할 대출{" "}
                    <select
                      aria-label="분석할 대출"
                      value={selectedLoan?.id ?? ""}
                      onChange={(e) => {
                        setSelectedLoanId(e.target.value);
                        const l = state.loans.find(
                          (l) => l.id === e.target.value,
                        );
                        if (l) setRate(String(l.rate + 0.5));
                      }}
                    >
                      {state.loans
                        .filter((l) => l.active)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <div className="loan-layout">
                  <div className="loan-list">
                    {state.loans
                      .filter((l) => !l.deletedAt)
                      .map((l) => (
                        <Panel
                          key={l.id}
                          title={l.name}
                          subtitle={`${l.method} · ${l.active ? "상환 중" : "상환 완료"}`}
                          action={
                            <div className="grid-row-actions">
                              <button
                                className="icon-button danger"
                                disabled={readOnly || busy}
                                aria-label={`${l.name} 대출 삭제`}
                                onClick={() =>
                                  requestDelete("loan", [l.id], l.name)
                                }
                              >
                                <Trash2 size={15} />
                              </button>
                              <button
                                disabled={readOnly}
                                onClick={() =>
                                  setEditor({ kind: "loan", value: l })
                                }
                                className={`tag ${l.verified ? "teal" : "amber"}`}
                                aria-label={`${l.name} 수정`}
                              >
                                {l.verified ? "대출 수정" : "잔액 확인 필요"}
                              </button>
                            </div>
                          }
                        >
                          <div className="loan-principal">
                            {won(l.principal)}
                            <small>원</small>
                          </div>
                          <div className="loan-facts">
                            <div>
                              <span>현재 금리</span>
                              <b>연 {l.rate.toFixed(2)}%</b>
                            </div>
                            <div>
                              <span>예상 월 원리금</span>
                              <b>{won(loanMonthly(l))}원</b>
                            </div>
                            <div>
                              <span>만기</span>
                              <b>{l.maturity ?? "미확인"}</b>
                            </div>
                            <div>
                              <span>금리 변경일</span>
                              <b>{l.rateDate ?? "미확인"}</b>
                            </div>
                          </div>
                        </Panel>
                      ))}
                  </div>
                  {selectedLoan &&
                    (selectedLoan.months !== null ||
                      selectedLoan.monthlyPrincipal > 0 ||
                      selectedLoan.method === "만기일시") && (
                      <Panel
                        title="금리 시뮬레이션"
                        subtitle="금리가 달라지면 월 상환액은 어떻게 될까요?"
                      >
                        <div className="simulation">
                          <p>{selectedLoan.name}</p>
                          <label>
                            예상 연 금리
                            <div className="rate-input">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                aria-label="시뮬레이션 금리"
                                value={rate}
                                onChange={(e) => setRate(e.target.value)}
                              />
                              <span>%</span>
                            </div>
                          </label>
                          <input
                            aria-label="금리 조절"
                            type="range"
                            min="0"
                            max="12"
                            step="0.1"
                            value={rate}
                            onChange={(e) => setRate(e.target.value)}
                          />
                          <div className="range-labels">
                            <span>0%</span>
                            <span>6%</span>
                            <span>12%</span>
                          </div>
                          <div className="simulation-result">
                            <span>예상 월 상환액</span>
                            <strong data-testid="sim-payment">
                              {Number(rate) >= 0 && Number(rate) <= 100
                                ? won(
                                    selectedLoan.monthlyPrincipal
                                      ? selectedLoan.monthlyPrincipal +
                                          (selectedLoan.principal *
                                            Number(rate)) /
                                            1200
                                      : payment(
                                          selectedLoan.principal,
                                          Number(rate),
                                          selectedLoan.months ?? 1,
                                          selectedLoan.method,
                                        ),
                                  )
                                : "—"}
                              <small>원</small>
                            </strong>
                          </div>
                          <p className="muted">
                            현재 잔액·잔여기간 고정 가정의 추정값입니다.
                            수수료와 금리 변경 조건은 반영하지 않습니다.
                          </p>
                        </div>
                      </Panel>
                    )}
                </div>
                <Panel
                  title="예상 상환 일정"
                  subtitle="첫 12회차 추정 · 중도상환과 수수료는 반영하지 않습니다."
                >
                  {selectedLoan && amortization(selectedLoan).length ? (
                    <div className="repayment-table">
                      <table>
                        <thead>
                          <tr>
                            <th>회차</th>
                            <th>상환 원금</th>
                            <th>이자</th>
                            <th>남은 원금</th>
                          </tr>
                        </thead>
                        <tbody>
                          {amortization(selectedLoan).map((r) => (
                            <tr key={r.period}>
                              <td>{r.period}회차</td>
                              <td>{won(r.principal)}원</td>
                              <td>{won(r.interest)}원</td>
                              <td>{won(r.balance)}원</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty">
                      잔여 기간이 확인되지 않아 상환 일정을 계산하지 않습니다.
                    </div>
                  )}
                </Panel>
                <div className="info-note">
                  <Info size={16} />
                  <p>
                    간이 DSR = 예상 연 원리금 ÷ 입력 연소득. 한도 사용률 = 간이
                    DSR ÷ 40%. 금융기관의 규제 DSR과 다르며, 대출별 실제 상환
                    스케줄·스트레스 금리·소득 인정 기준을 반영하지 않습니다.
                  </p>
                </div>
              </>
            )}
            {section === "이력 및 통계" && (
              <>
                <HistoryImport
                  enabled={state.mode === "sheets"}
                  onImported={async () => {
                    await load();
                    setToast("과거 자산 상세 기록을 반영했습니다.");
                  }}
                />
                {!!state.assetHistory?.length && (
                  <Panel
                    title="가져온 과거 상세 기록"
                    subtitle="현재 잔액과 분리된 미확인 원본 기록입니다."
                  >
                    <div className="history-list">
                      {[...state.assetHistory].reverse().map((record) => (
                        <div className="history-row" key={record.date}>
                          <div>
                            <b>{record.date}</b>
                            <p>
                              {Object.keys(record.values).length}개 항목 · 시트
                              가져옴 · 미확인
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            className="danger"
                            disabled={readOnly || busy}
                            aria-label={`${record.date} 상세 기록 삭제`}
                            onClick={() =>
                              requestDelete(
                                "record",
                                [record.date],
                                record.date,
                              )
                            }
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}
                <Panel
                  title="항목별 변경 추이"
                  subtitle="자산과 카테고리를 골라 상세 기록을 비교하세요."
                >
                  <AssetTrend state={state} />
                </Panel>
                <Panel
                  title="기록으로 보는 순자산"
                  subtitle="기록이 없는 월을 보간해 측정값으로 만들지 않습니다."
                  action={
                    <Button variant="outline" onClick={exportData}>
                      <Download size={15} />
                      기록 내보내기
                    </Button>
                  }
                >
                  <TrendChart state={state} period="전체" />
                </Panel>
                <Panel
                  title="날짜별 기록"
                  subtitle="기록탭 날짜와 원본에 입력된 기준일을 함께 확인하세요."
                >
                  <div className="history-list">
                    {records
                      .slice()
                      .reverse()
                      .map((h, i) => (
                        <div className="history-row" key={`${h.date}-${i}`}>
                          <span className="history-dot" />
                          <div>
                            <b>{h.date}</b>
                            <small>
                              원본 기준일 {h.sourceDate}
                              {h.date !== h.sourceDate ? " · 날짜 불일치" : ""}
                            </small>
                          </div>
                          <span
                            className={
                              h.date !== h.sourceDate ? "tag amber" : "tag"
                            }
                          >
                            {h.date !== h.sourceDate ? "검증 필요" : "기록값"}
                          </span>
                          <strong>
                            {won(h.assets - h.debt)}
                            <small>원</small>
                          </strong>
                          <button
                            className="icon-button danger"
                            disabled={readOnly || busy}
                            aria-label={`${h.date} 기록 삭제`}
                            onClick={() =>
                              requestDelete(
                                "record",
                                [h.date],
                                `${h.date} 기록`,
                              )
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                  </div>
                </Panel>
                <Panel
                  title="수정 이력"
                  subtitle="날짜별 스냅샷과 별도로 보관합니다."
                >
                  {state.audit.length ? (
                    state.audit.slice(0, 20).map((a) => (
                      <div className="audit-row" key={a.id}>
                        <CheckCircle2 size={16} />
                        <span>{a.description}</span>
                        <small>
                          {new Date(a.at).toLocaleString("ko-KR", {
                            timeZone: "Asia/Seoul",
                          })}
                        </small>
                        <button
                          className="icon-button danger"
                          disabled={readOnly || busy}
                          aria-label={`${a.description} 이력 삭제`}
                          onClick={() =>
                            requestDelete("audit", [a.id], "수정 이력")
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="empty">
                      아직 수정 이력이 없어요. 첫 자산 기록을 남겨보세요.
                    </div>
                  )}
                </Panel>
                <div className="info-note">
                  <Info size={16} />
                  <p>
                    순자산 변화에는 입출금·부채·평가액 변화가 함께 포함됩니다.
                    거래 기록이 없어 실현손익과 기간 투자수익률은 계산하지
                    않습니다.
                  </p>
                </div>
              </>
            )}
            {section === "설정" && (
              <div className="settings-grid">
                <Panel
                  title="자산 카테고리 관리"
                  subtitle="사용 중인 분류는 자산에서 변경한 뒤 삭제할 수 있습니다."
                >
                  <div className="category-manager">
                    <div className="category-tags">
                      {categories.map((c) => (
                        <span key={c} className="tag">
                          {c}
                          <button
                            aria-label={`${c} 카테고리 삭제`}
                            disabled={
                              readOnly ||
                              busy ||
                              categories.length <= 1 ||
                              state.assets.some(
                                (a) => !a.deletedAt && a.category === c,
                              )
                            }
                            onClick={() =>
                              void persist({
                                ...state,
                                settings: {
                                  ...state.settings,
                                  assetCategories: categories.filter(
                                    (x) => x !== c,
                                  ),
                                },
                              }).catch(() => {})
                            }
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const name = newCategory.trim();
                        if (
                          !name ||
                          name.length > 20 ||
                          categories.includes(name)
                        )
                          return;
                        void persist({
                          ...state,
                          settings: {
                            ...state.settings,
                            assetCategories: [...categories, name],
                          },
                        })
                          .then(() => setNewCategory(""))
                          .catch(() => {});
                      }}
                    >
                      <input
                        aria-label="새 자산 카테고리"
                        maxLength={20}
                        placeholder="새 분류 이름"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        disabled={readOnly}
                      />
                      <Button
                        disabled={readOnly || busy || !newCategory.trim()}
                      >
                        추가
                      </Button>
                    </form>
                  </div>
                </Panel>
                <GoogleConnectionPanel onConnected={load} />
                <TrashPanel
                  state={state}
                  disabled={readOnly || busy}
                  onRestore={(id) =>
                    setPendingAction({
                      title: "휴지통 항목 복원",
                      description: "이 항목을 다시 사용하도록 복원합니다.",
                      body: {
                        kind: "restoreTrash",
                        id,
                        requestId: crypto.randomUUID(),
                      },
                    })
                  }
                  onPurge={(id) =>
                    setPendingAction({
                      title: "영구 삭제",
                      description:
                        "선택한 휴지통 항목과 연결된 자산 상세 기록을 영구 삭제합니다. 서버의 자동 백업은 별도로 유지됩니다.",
                      body: {
                        kind: "purgeTrash",
                        id,
                        requestId: crypto.randomUUID(),
                      },
                    })
                  }
                  onClear={() =>
                    setPendingAction({
                      title: "전체 데이터 삭제",
                      description:
                        "현재 앱의 자산·지출·대출·스냅샷·수정 이력을 모두 비우고 휴지통에 보관합니다. 원본과 기존 Google 관리 탭은 변경하지 않습니다.",
                      body: {
                        kind: "clearAll",
                        requestId: crypto.randomUUID(),
                      },
                    })
                  }
                  onAuditClear={() =>
                    setPendingAction({
                      title: "수정 이력 전체 삭제",
                      description:
                        "현재 수정 이력을 휴지통에 보관하고 목록에서 제거합니다.",
                      body: {
                        kind: "clearAudit",
                        requestId: crypto.randomUUID(),
                      },
                    })
                  }
                />
                <Panel
                  title="화면과 표시"
                  subtitle="편안한 금융 생활을 위한 나만의 설정"
                >
                  <div className="setting-row">
                    <div>
                      <b>화면 테마</b>
                      <p>밝은 화면과 어두운 화면을 전환합니다.</p>
                    </div>
                    <button
                      className={`switch ${dark ? "on" : ""}`}
                      role="switch"
                      aria-checked={dark}
                      aria-label="다크 테마 사용"
                      onClick={() => setDark(!dark)}
                    >
                      <i />
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <b>표시 통화 · 숫자 단위</b>
                      <p>원화 (KRW) · 상세 금액은 원 단위</p>
                    </div>
                    <span className="tag">₩ KRW</span>
                  </div>
                  <div className="setting-row">
                    <div>
                      <b>계획 월수입</b>
                      <p>급여 공제 후 통장 입금액 기준</p>
                    </div>
                    <MoneyInput
                      className="income-input"
                      aria-label="계획 월수입"

                      min="0"
                      defaultValue={state.settings.income}
                      key={`${state.mode}-${state.revision}-income`}
                      disabled={readOnly || busy}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (
                          Number.isSafeInteger(n) &&
                          n >= 0 &&
                          n !== state.settings.income
                        )
                          void persist({
                            ...state,
                            settings: { ...state.settings, income: n },
                          }).catch(() => {});
                        else
                          e.target.value = formatMoneyInput(
                            state.settings.income,
                          );
                      }}
                    />
                  </div>
                  <div className="setting-row">
                    <div>
                      <b>간이 DSR용 연소득</b>
                      <p>0으로 비우면 DSR 비율을 계산하지 않습니다.</p>
                    </div>
                    <MoneyInput
                      className="income-input"
                      aria-label="간이 DSR용 연소득"

                      min="0"
                      defaultValue={state.settings.annualIncome}
                      key={`${state.mode}-${state.revision}-annual-income`}
                      disabled={readOnly || busy}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (
                          Number.isSafeInteger(n) &&
                          n >= 0 &&
                          n !== state.settings.annualIncome
                        )
                          void persist({
                            ...state,
                            settings: { ...state.settings, annualIncome: n },
                          }).catch(() => {});
                        else
                          e.target.value = formatMoneyInput(
                            state.settings.annualIncome,
                          );
                      }}
                    />
                  </div>
                </Panel>
                <Panel
                  title="백업과 복원"
                  subtitle="데이터는 나의 통제 아래 안전하게"
                >
                  <div className="setting-row">
                    <span className="setting-icon">
                      <Download size={19} />
                    </span>
                    <div>
                      <b>전체 데이터 내보내기</b>
                      <p>자산·지출·스냅샷·수정 이력을 JSON으로 저장</p>
                    </div>
                    <Button variant="outline" onClick={exportData}>
                      내보내기
                    </Button>
                  </div>
                  <div className="setting-row">
                    <span className="setting-icon">
                      <Upload size={19} />
                    </span>
                    <div>
                      <b>백업 복원</b>
                      <p>확인 후 현재 작업 데이터를 교체합니다.</p>
                    </div>
                    <label className="button btn-outline file-button">
                      파일 선택
                      <input
                        aria-label="백업 파일 선택"
                        type="file"
                        accept=".json"
                        disabled={readOnly}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const parsed = stateSchema.parse(
                              JSON.parse(await file.text()),
                            );
                            if (parsed.mode === "demo" && state.mode !== "demo")
                              throw Error();
                            setConfirmRestore(parsed);
                          } catch {
                            setError(
                              "백업 형식을 확인하세요. 실제 데이터에 데모 백업을 덮어쓸 수 없습니다.",
                            );
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </Panel>
                <Panel
                  title="데이터 관리 원칙"
                  subtitle="확인한 정보만, 정확한 의미로"
                >
                  <div className="principles">
                    <p>
                      <Check size={16} />
                      급여공제·저축·이체를 소비와 중복 집계하지 않습니다.
                    </p>
                    <p>
                      <Check size={16} />
                      갱신하지 않은 자산은 기존 평가일을 유지합니다.
                    </p>
                    <p>
                      <Check size={16} />
                      동일 날짜의 스냅샷은 하나로 유지합니다.
                    </p>
                    <p>
                      <Check size={16} />
                      기준일 불일치를 현재 잔액으로 간주하지 않습니다.
                    </p>
                  </div>
                </Panel>
              </div>
            )}
            <footer className="app-footer">
              <span>
                fin:o <i>·</i> 나를 위한 금융의 기록
              </span>
              <span>
                <ShieldCheck size={12} />
                {readOnly ? "실제 기록 · 읽기 전용 보관본" : sourceLabel}
              </span>
            </footer>
          </main>
        </div>
        <AnimatePresence>
          {toast && (
            <motion.div
              className="toast"
              role="status"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <CheckCircle2 size={18} />
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
        {trendId !== null && (
          <Modal title="자산 변경 추이" onClose={() => setTrendId(null)}>
            <AssetTrend state={state} initialId={trendId} />
          </Modal>
        )}
        {pendingAction && (
          <Modal
            title={pendingAction.title}
            onClose={() => !busy && setPendingAction(null)}
          >
            <p className="delete-summary">{pendingAction.description}</p>
            <p className="muted">
              {state.mode === "sheets"
                ? "이 변경은 Google 앱 전용 탭에 반영됩니다."
                : "이 변경은 현재 로컬 작업본에 반영됩니다."}{" "}
              삭제 전 자동 백업을 생성합니다.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="delete-buttons">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setPendingAction(null)}
              >
                취소
              </Button>
              <Button
                className="danger-button"
                disabled={busy}
                onClick={performAction}
              >
                {busy ? "처리 중" : "확인하고 실행"}
              </Button>
            </div>
          </Modal>
        )}
        {notifications && (
          <Modal title="확인할 알림" onClose={() => setNotifications(false)}>
            <div className="notification-list">
              <Info size={22} />
              <h3>
                {readOnly
                  ? "기존 기록 검증이 필요해요"
                  : "자산을 최신 상태로 유지하세요"}
              </h3>
              <p>
                {readOnly
                  ? "탭 날짜와 기준일이 다릅니다. 전세대출 상환 여부와 보험 유지 상태도 확인이 필요합니다."
                  : state.mode === "demo"
                    ? "현재 화면은 데모입니다. 실제 계좌 잔액은 자동 조회하지 않습니다."
                    : "현재 자료에는 과거 기록이 포함되어 있습니다. Google 연동은 금융기관 잔액 자동 조회가 아니므로 실제 계좌 잔액을 확인해 기록해 주세요."}
              </p>
              {state.expenses
                .filter((e) => e.active && e.maturityDate)
                .map((e) => (
                  <div key={e.id}>
                    <b>{e.name}</b>
                    <p>
                      보험·계약 만기 {e.maturityDate} · 유지 여부를 확인하세요.
                    </p>
                  </div>
                ))}
              {state.loans
                .filter((l) => l.active)
                .map((l) => (
                  <div key={l.id}>
                    <b>{l.name}</b>
                    <p>
                      금리 변경일 {l.rateDate ?? "미확인"} · 만기{" "}
                      {l.maturity ?? "미확인"}
                    </p>
                  </div>
                ))}
            </div>
          </Modal>
        )}
        {editor?.kind === "asset" && (
          <AssetForm
            onDelete={
              editor.value
                ? () =>
                    requestDelete(
                      "asset",
                      [editor.value!.id],
                      editor.value!.name,
                    )
                : undefined
            }
            asset={editor.value}
            categories={categories}
            onClose={() => setEditor(null)}
            onSave={async (a) => {
              await persist({
                ...state,
                assets: state.assets.some((x) => x.id === a.id)
                  ? state.assets.map((x) => (x.id === a.id ? a : x))
                  : [...state.assets, a],
              }).catch(() => {});
            }}
          />
        )}
        {editor?.kind === "expense" && (
          <ExpenseForm
            onDelete={
              editor.value
                ? () =>
                    requestDelete(
                      "expense",
                      [editor.value!.id],
                      editor.value!.name,
                    )
                : undefined
            }
            expense={editor.value}
            onClose={() => setEditor(null)}
            onSave={async (e) => {
              await persist({
                ...state,
                expenses: state.expenses.some((x) => x.id === e.id)
                  ? state.expenses.map((x) => (x.id === e.id ? e : x))
                  : [...state.expenses, e],
              }).catch(() => {});
            }}
          />
        )}
        {editor?.kind === "loan" && (
          <Modal
            title={editor.value ? "대출 수정" : "대출 추가"}
            onClose={() => setEditor(null)}
          >
            <LoanEditor
              onDelete={
                editor.value
                  ? () =>
                      requestDelete(
                        "loan",
                        [editor.value!.id],
                        editor.value!.name,
                      )
                  : undefined
              }
              loan={editor.value}
              onSave={async (l) => {
                await persist({
                  ...state,
                  loans: state.loans.some((x) => x.id === l.id)
                    ? state.loans.map((x) => (x.id === l.id ? l : x))
                    : [...state.loans, l],
                }).catch(() => {});
              }}
            />
          </Modal>
        )}
        {preview && (
          <Modal
            title="변경사항을 확인해 주세요"
            onClose={() => setPreview(false)}
          >
            <p className="muted">
              {date} 기준 · 기존 날짜 기록이 있으면 덮어쓰고 수정 이력을
              남깁니다.
            </p>
            <div className="preview-list">
              {Object.entries(changes).map(([id, v]) => (
                <div key={id}>
                  <b>{state.assets.find((a) => a.id === id)?.name}</b>
                  <span>
                    {won(baseValues[id] ?? 0)}원 <ArrowRight size={13} />{" "}
                    <strong>{won(Number(v))}원</strong>
                  </span>
                </div>
              ))}
            </div>
            <div className="form-summary">
              총 증감
              <strong>
                {changeSum >= 0 ? "+" : ""}
                {won(changeSum)}원
              </strong>
            </div>
            <p className="small-text muted">
              변경하지 않은 항목은 이월값입니다. 실제 확인한 잔액과 구분합니다.
            </p>
            <Button disabled={busy} onClick={save}>
              {busy ? (
                <RefreshCw size={16} className="spin" />
              ) : (
                <Check size={16} />
              )}
              기록 저장
            </Button>
          </Modal>
        )}
        {confirmRestore && (
          <Modal
            title="백업을 복원할까요?"
            onClose={() => setConfirmRestore(null)}
          >
            <p>
              현재 작업 데이터를 선택한 백업으로 교체합니다. 먼저 현재 데이터를
              내보내 보관하세요.
            </p>
            <p className="muted">
              자산 {confirmRestore.assets.length}개 · 기록{" "}
              {confirmRestore.snapshots.length}개
            </p>
            <div className="setting-actions">
              <Button variant="outline" onClick={exportData}>
                현재 데이터 백업
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void persist(confirmRestore, "restore").catch(() => {})
                }
              >
                복원 확인
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </MotionConfig>
  );
}
