"use client";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  TrendingUp,
  ChevronRight,
  Landmark,
  Info,
  Clock,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import { State, totals, cashflow, timeline, won, compact } from "@/lib/domain";
import { Panel } from "./ui/panel";
import { Composition, TrendChart, palette } from "./charts";
export function Dashboard({
  state,
  period,
  setPeriod,
  navigate,
}: {
  state: State;
  period: string;
  setPeriod: (p: string) => void;
  navigate: (s: string) => void;
}) {
  const t = totals(state),
    cf = cashflow(state),
    previous = timeline(state).at(-2),
    delta = previous ? t.net - (previous.assets - previous.debt) : 0,
    changePct =
      previous && previous.assets !== previous.debt
        ? (delta / Math.abs(previous.assets - previous.debt)) * 100
        : 0,
    activeAssets = state.assets.filter((a) => a.active),
    ordered = activeAssets.slice().sort((a, b) => b.value - a.value),
    readOnly = state.mode === "imported",
    latestDate = state.snapshots.at(-1)?.date ?? state.assets[0]?.date;
  return (
    <>
      <div className="overview-grid">
        <section className="net-card">
          <div className="net-top">
            <span>
              <span className="tiny-circle">
                <Wallet size={15} />
              </span>
              나의 순자산
            </span>
            <span className="net-date">
              {latestDate?.replaceAll("-", ".")} 기준
            </span>
          </div>
          <div className="net-number">
            {won(t.net)}
            <span>원</span>
          </div>
          <div className="net-change">
            {delta >= 0 ? (
              <ArrowUpRight size={16} />
            ) : (
              <ArrowDownRight size={16} />
            )}
            <b>
              {delta >= 0 ? "+" : "−"}
              {won(Math.abs(delta))}원
            </b>
            <span>
              직전 기록 대비 {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(1)}%
            </span>
          </div>
          <div className="net-footer">
            <span>나의 자산이 만드는 더 나은 일상</span>
            <button onClick={() => navigate("이력 및 통계")}>
              기록 보기 <ArrowRight size={14} />
            </button>
          </div>
          <div className="net-decoration" aria-hidden="true">
            <div />
            <div />
            <div />
          </div>
        </section>
        <section className="metric-card">
          <div className="metric-label">
            총자산{" "}
            <span className="metric-icon teal">
              <Wallet size={18} />
            </span>
          </div>
          <strong>
            {won(t.assets)}
            <small>원</small>
          </strong>
          <div className="metric-bottom">
            <span className="positive">
              <TrendingUp size={13} /> {activeAssets.length}개 자산
            </span>
            <span>나의 모든 자산</span>
          </div>
          <div className="asset-distribution" aria-label="자산별 평가액 비중">
            {ordered.map((a, i) => (
              <i
                key={a.id}
                style={{
                  width: `${(a.value / Math.max(t.assets, 1)) * 100}%`,
                  background: palette[i % palette.length],
                }}
                title={`${a.name} ${won(a.value)}원`}
              />
            ))}
          </div>
          <div className="distribution-caption">평가액 기준 자산 비중</div>
        </section>
        <section className="metric-card debt-card">
          <div className="metric-label">
            총부채{" "}
            <span className="metric-icon blue">
              <Landmark size={18} />
            </span>
          </div>
          <strong>
            {won(t.debt)}
            <small>원</small>
          </strong>
          <div className="metric-bottom">
            <span>
              {state.loans.filter((l) => l.active).length}개 대출 이용 중
            </span>
            <button onClick={() => navigate("대출 관리")}>
              관리하기 <ChevronRight size={12} />
            </button>
          </div>
          <div className="debt-progress">
            <i
              style={{
                width: `${t.assets > 0 ? Math.min(100, (t.debt / t.assets) * 100) : 0}%`,
              }}
            />
          </div>
          <div className="debt-foot">
            자산 대비 부채 비율{" "}
            <b>
              {t.assets > 0
                ? `${((t.debt / t.assets) * 100).toFixed(1)}%`
                : "—"}
            </b>
          </div>
        </section>
      </div>
      <div className="analysis-grid">
        <Panel
          title="순자산의 흐름"
          subtitle="차곡차곡 쌓여가는 나의 자산 기록"
          action={
            <div className="period-tabs">
              {["3개월", "6개월", "1년", "전체"].map((p) => (
                <button
                  key={p}
                  className={p === period ? "selected" : ""}
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          }
        >
          <div className="chart-summary">
            <strong>
              {compact(t.net)}
              <span>원</span>
            </strong>
            <span className={delta >= 0 ? "positive" : "negative"}>
              {delta >= 0 ? (
                <ArrowUpRight size={14} />
              ) : (
                <ArrowDownRight size={14} />
              )}{" "}
              {Math.abs(changePct).toFixed(1)}% <small>직전 기록 대비</small>
            </span>
          </div>
          <TrendChart state={state} period={period} />
          <div className="chart-note">
            <span>
              <i /> 순자산
            </span>
            <span>실제 기록일 기준 · 기록 간 추이는 참고용</span>
          </div>
        </Panel>
        <Panel
          title="내 자산의 구성"
          subtitle="자산을 균형 있게, 한눈에"
          action={
            <button
              className="icon-button ghost"
              aria-label="자산 구성 상세"
              onClick={() => navigate("자산 관리")}
            >
              <ArrowUpRight size={18} />
            </button>
          }
        >
          <Composition state={state} />
          <div className="composition-footer">
            <span>자산을 더 자세히 살펴볼까요?</span>
            <button onClick={() => navigate("자산 관리")}>
              전체 자산 <ChevronRight size={13} />
            </button>
          </div>
        </Panel>
      </div>
      <div className="detail-grid">
        <Panel
          title="이번 달의 현금흐름"
          action={
            <button
              className="text-button"
              onClick={() => navigate("고정지출")}
            >
              자세히 <ChevronRight size={13} />
            </button>
          }
        >
          <div className="cashflow-row">
            <span>계획 수입</span>
            <strong>{won(state.settings.income)}원</strong>
          </div>
          <div className="cashflow-row">
            <span>
              {cf.unknownLoans
                ? "확인된 월 환산 배정·지출"
                : "월 환산 배정·지출"}
            </span>
            <strong>{won(cf.budgetKnown)}원</strong>
          </div>
          <div className="flow-track">
            <i
              style={{
                width: `${state.settings.income > 0 ? Math.min(100, (cf.budgetKnown / state.settings.income) * 100) : 0}%`,
              }}
            />
          </div>
          <div className="flow-ratio">
            {state.settings.income > 0 ? (
              <>
                수입의{" "}
                <b>
                  {((cf.budgetKnown / state.settings.income) * 100).toFixed(1)}%
                </b>
                를 배정했어요
              </>
            ) : (
              "계획 수입을 입력하면 배정 비율을 볼 수 있어요"
            )}
          </div>
          <div className="remaining">
            <span>
              예상 잔여 예산 <Info size={13} />
            </span>
            <strong
              className={
                cf.remaining !== null && cf.remaining >= 0
                  ? "positive"
                  : "negative"
              }
            >
              {cf.remaining === null
                ? "대출 정보 확인 필요"
                : won(cf.remaining)}
              {cf.remaining !== null && <small>원</small>}
            </strong>
          </div>
          {cf.unknownLoans > 0 && (
            <p className="muted">
              월 상환액 미확인 대출 {cf.unknownLoans}건이 있어 전체 배정액·잔여
              예산은 계산을 보류합니다.
            </p>
          )}
        </Panel>
        <Panel
          title="주요 계좌"
          action={
            <button
              className="text-button"
              onClick={() => navigate("자산 관리")}
            >
              전체 보기 <ChevronRight size={13} />
            </button>
          }
        >
          <div className="account-list">
            {ordered
              .filter((a) => a.category !== "부동산")
              .slice(0, 3)
              .map((a, i) => (
                <div className="account-row" key={a.id}>
                  <span className={`bank-icon bank-${i}`}>
                    {a.institution.slice(0, 1)}
                  </span>
                  <div>
                    <b>{a.name}</b>
                    <small>{a.institution}</small>
                  </div>
                  <strong>
                    {won(a.value)}
                    <small>원</small>
                  </strong>
                </div>
              ))}
          </div>
          <div className="account-caption">
            <Clock size={12} />
            마지막 평가일 {latestDate} · 수기 기록
          </div>
        </Panel>
        <Panel
          title="다가오는 고정지출"
          action={
            <button
              className="text-button"
              onClick={() => navigate("고정지출")}
            >
              전체 <ChevronRight size={13} />
            </button>
          }
        >
          <div className="upcoming-list">
            {state.expenses
              .filter(
                (e) =>
                  e.active &&
                  e.cycle === "월" &&
                  e.category === "소비지출" &&
                  e.day !== null,
              )
              .sort((a, b) => (a.day ?? 32) - (b.day ?? 32))
              .slice(0, 3)
              .map((e, i) => (
                <div className="upcoming-row" key={e.id}>
                  <div className="day-box">
                    <small>매월</small>
                    <b>{e.day}</b>
                  </div>
                  <div>
                    <b>{e.name}</b>
                    <small>{e.account || "출금계좌 미지정"}</small>
                  </div>
                  <strong>
                    {won(e.amount)}
                    <small>원</small>
                  </strong>
                </div>
              ))}
            {!state.expenses.some(
              (e) =>
                e.active &&
                e.cycle === "월" &&
                e.category === "소비지출" &&
                e.day !== null,
            ) && <p className="empty">납부일이 확인된 지출이 없습니다.</p>}
          </div>
          <div className="upcoming-caption">
            <CalendarDays size={13} />
            납부일 계획 · 실제 출금 여부는 별도 확인
          </div>
        </Panel>
      </div>
      <div className="insight-strip">
        <span className="insight-icon">
          <ShieldCheck size={20} />
        </span>
        <div>
          <b>기록이 쌓일수록, 나의 금융 생활이 선명해져요.</b>
          <p>
            {readOnly
              ? "기준일 불일치와 상환 여부를 확인한 뒤 현재 잔액을 기록하세요."
              : "아직 갱신하지 않은 자산은 이전 평가일을 유지해, 확인한 값과 구분합니다."}
          </p>
        </div>
        <button
          onClick={() => navigate("오늘의 자산 등록")}
          disabled={readOnly}
        >
          오늘도 기록하기 <ArrowRight size={15} />
        </button>
      </div>
    </>
  );
}
