"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { State, compact, won, timeline } from "@/lib/domain";
export const palette = ["#1b8a7b", "#5c76bb", "#9daed0", "#d0a76b", "#c5cdd9"];
export function TrendChart({
  state,
  period = "전체",
}: {
  state: State;
  period?: string;
}) {
  const all = timeline(state).map((h) => ({
    date: h.date,
    time: Date.parse(h.date),
    value: h.assets - h.debt,
  }));
  const end = all.at(-1)?.date ?? "2026-11-20";
  const cutoff = new Date(end);
  if (period !== "전체")
    cutoff.setMonth(
      cutoff.getMonth() -
        ({ "3개월": 3, "6개월": 6, "1년": 12 }[period] ?? 120),
    );
  const data = all.filter(
    (p) => period === "전체" || new Date(p.date) >= cutoff,
  );
  return (
    <div className="trend-chart" aria-label="기록일별 순자산 추이">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 18, right: 15, left: 4, bottom: 0 }}
        >
          <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#258f80" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#258f80" stopOpacity={0} />
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
            tickFormatter={(v) => {
              const d = new Date(v).toISOString();
              return `${d.slice(2, 4)}.${d.slice(5, 7)}`;
            }}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            minTickGap={28}
            dy={8}
          />
          <YAxis
            tickFormatter={(v) => compact(v)}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            width={66}
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="chart-tooltip">
                  {typeof label === "number"
                    ? new Date(label).toISOString().slice(0, 10)
                    : label}
                  <strong>{won(Number(payload[0].value))}원</strong>
                </div>
              ) : null
            }
          />
          <Area
            type="linear"
            dataKey="value"
            stroke="var(--chart-line)"
            strokeWidth={2.5}
            fill="url(#area)"
            dot={{
              r: 3,
              stroke: "var(--chart-line)",
              strokeWidth: 2,
              fill: "var(--surface)",
            }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      {data.length < 2 && (
        <span className="chart-empty">
          선택 기간에 기록이 {data.length}개 있습니다.
        </span>
      )}
    </div>
  );
}
export function Composition({ state }: { state: State }) {
  const groups = state.assets
    .filter((a) => a.active)
    .reduce(
      (o, a) => ({ ...o, [a.category]: (o[a.category] ?? 0) + a.value }),
      {} as Record<string, number>,
    );
  const data = Object.entries(groups)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const total = data.reduce((s, a) => s + a.value, 0);
  return (
    <div className="composition">
      <div className="donut">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius="72%"
              outerRadius="94%"
              paddingAngle={3}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={palette[i % palette.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => `${won(Number(v))}원`}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                color: "var(--text)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-label">
          <span>총자산</span>
          <strong>{compact(total)}</strong>
        </div>
      </div>
      <div className="legend">
        {data.map((d, i) => (
          <div key={d.name}>
            <span>
              <i style={{ background: palette[i % palette.length] }} />
              {d.name}
            </span>
            <b>
              {total ? ((d.value / total) * 100).toFixed(1) : "0"}
              <small>%</small>
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}
