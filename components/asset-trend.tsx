"use client";
import { ASSET_TYPES, orderedLabels, groupAssets } from "@/lib/classification";
import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Info,
} from "lucide-react";
import { type State, won, compact } from "@/lib/domain";
import { assetTrend, categoryTrend, filterTrend } from "@/lib/asset-trends";
export function AssetTrend({
  state,
  initialId,
}: {
  state: State;
  initialId?: string;
}) {
  const [selection, setSelection] = useState(
    `asset:${initialId ?? state.assets.find((a) => !a.deletedAt)?.id ?? ""}`,
  );
  const [period, setPeriod] = useState("전체");
  const gradient = useId().replaceAll(":", "");
  const category = selection.startsWith("category:");
  const key = selection.slice(selection.indexOf(":") + 1);
  const asset = state.assets.find((a) => a.id === key);
  const title = category ? `${key} 합계` : (asset?.name ?? "자산");
  const all = category ? categoryTrend(state, key) : assetTrend(state, key);
  const points = filterTrend(all, period);
  const first = points[0],
    last = points.at(-1),
    previous = points.at(-2);
  const delta = first && last ? last.value - first.value : null;
  const percent =
    first && first.value !== 0 && delta !== null
      ? (delta / first.value) * 100
      : null;
  const data = points.map((p) => ({ ...p, time: Date.parse(p.date) }));
  const categories = orderedLabels(
    state.assets.filter((a) => !a.deletedAt).map((a) => a.category),
    ASSET_TYPES,
  );
  return (
    <div className="asset-trend-explorer">
      <div className="item-trend-controls">
        <label>
          변경 추이를 볼 항목
          <select
            aria-label="추이 항목 선택"
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
          >
            <optgroup label="개별 자산">
              {groupAssets(state.assets)
                .flatMap((group) => group.items)
                .map((a) => (
                  <option key={a.id} value={`asset:${a.id}`}>
                    {a.name}
                    {!a.active ? " (비활성)" : ""}
                  </option>
                ))}
            </optgroup>
            <optgroup label="카테고리 합계">
              {categories.map((c) => (
                <option key={c} value={`category:${c}`}>
                  {c} 합계
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="period-tabs" aria-label="추이 기간">
          {["3개월", "6개월", "1년", "전체"].map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={p === period}
              className={p === period ? "selected" : ""}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="item-trend-heading">
        <div>
          <span>
            {title} · 마지막 기록 {last?.date ?? "없음"}
          </span>
          <strong>{last ? `${won(last.value)}원` : "기록 없음"}</strong>
        </div>
        <div
          className={`item-trend-change ${delta !== null && delta < 0 ? "negative" : "positive"}`}
        >
          {points.length > 1 && delta !== null ? (
            <>
              <b>
                {delta < 0 ? (
                  <ArrowDownRight size={15} />
                ) : (
                  <ArrowUpRight size={15} />
                )}{" "}
                {delta > 0 ? "+" : ""}
                {won(delta)}원
                {percent !== null
                  ? ` (${percent > 0 ? "+" : ""}${percent.toFixed(1)}%)`
                  : ""}
              </b>
              <span>선택 기간 첫 기록 대비 · {first?.date}</span>
            </>
          ) : (
            <span className="muted">비교할 상세 기록이 더 필요해요</span>
          )}
        </div>
      </div>
      {data.length > 1 ? (
        <div
          className="item-trend-chart"
          role="img"
          aria-label={`${title} 평가액 변화, ${first.date}부터 ${last!.date}까지`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 18, right: 18, left: 0, bottom: 10 }}
            >
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--chart-line)"
                    stopOpacity={0.18}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--chart-line)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--line)"
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                ticks={data.map((p) => p.time)}
                tickFormatter={(v) =>
                  new Date(v).toISOString().slice(5, 10).replace("-", ".")
                }
                axisLine={false}
                tickLine={false}
                minTickGap={30}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
              />
              <YAxis
                width={72}
                domain={["auto", "auto"]}
                tickFormatter={(value: number) =>
                  Math.abs(value) < 10000 ? `${won(value)}원` : compact(value)
                }
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload;
                  return active && p ? (
                    <div className="chart-tooltip">
                      {p.date}
                      <strong>{won(p.value)}원</strong>
                      <span>
                        {p.confirmed
                          ? "확인한 기록"
                          : p.imported
                            ? "시트 가져옴 · 미확인"
                            : state.mode === "imported"
                              ? "검증 전 기록"
                              : "이월값 · 미확인"}
                      </span>
                    </div>
                  ) : null;
                }}
              />
              <Area
                type="stepAfter"
                dataKey="value"
                stroke="var(--chart-line)"
                strokeWidth={2.5}
                fill={`url(#${gradient})`}
                isAnimationActive={false}
                dot={({ cx, cy, payload }) => (
                  <circle
                    key={payload.date}
                    cx={cx}
                    cy={cy}
                    r={4}
                    stroke="var(--chart-line)"
                    strokeWidth={2}
                    fill={
                      payload.confirmed ? "var(--chart-line)" : "var(--surface)"
                    }
                  />
                )}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="item-trend-empty">
          <ChartNoAxesCombined size={27} />
          <b>
            {points.length === 1
              ? "첫 기록이 준비됐어요"
              : "아직 상세 기록이 없어요"}
          </b>
          <p>
            {points.length === 1
              ? "다른 날짜의 자산 기록을 저장하면 변화 차트가 표시됩니다."
              : "이 항목이 포함된 자산 스냅샷을 저장해 주세요."}
          </p>
        </div>
      )}
      <div className="item-trend-note">
        <Info size={14} />
        <p>
          {category
            ? "현재 카테고리 분류로 합산했습니다. 과거 분류 변경 이력은 반영하지 않습니다."
            : "잔액 증감에는 입출금과 평가액 변화가 함께 포함되며, 투자수익을 의미하지 않습니다."}{" "}
          {state.mode === "imported"
            ? "과거 보관본은 검증 전 값입니다."
            : "빈 원은 이월값 또는 시트에서 가져온 미확인 기록입니다."}{" "}
          기록 사이의 값은 측정하지 않았습니다.
        </p>
      </div>
      <div className="item-trend-records" aria-label={`${title} 날짜별 기록`}>
        <div className="item-trend-record-header">
          <b>날짜별 상세 기록</b>
          <span>{points.length}개 · 기간은 이 항목의 마지막 기록 기준</span>
        </div>
        {[...points].reverse().map((p) => {
          const index = points.indexOf(p),
            prior = points[index - 1],
            change = prior ? p.value - prior.value : null;
          return (
            <div className="item-trend-record" key={p.date}>
              <div>
                <b>{p.date}</b>
                {p.sourceDate && p.sourceDate !== p.date && (
                  <small>원본 기준일 {p.sourceDate} · 탭 날짜와 다름</small>
                )}
                <small>
                  {p.confirmed
                    ? "확인한 잔액"
                    : p.imported
                      ? "시트 가져옴 · 미확인"
                      : state.mode === "imported"
                        ? "검증 전 기록"
                        : "이월값 · 미확인"}
                </small>
              </div>
              <strong>
                {won(p.value)}
                <small>원</small>
              </strong>
              <span
                className={
                  change !== null && change < 0
                    ? "negative"
                    : change !== null && change > 0
                      ? "positive"
                      : "muted"
                }
              >
                {change === null
                  ? "첫 기록"
                  : `${change > 0 ? "+" : ""}${won(change)}원`}
              </span>
            </div>
          );
        })}
        {!points.length && (
          <p className="empty">선택한 항목의 상세 기록이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
