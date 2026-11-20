"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { assetJournal } from "@/lib/asset-journal";
import { type State, won } from "@/lib/domain";
const stamp = (at: string) =>
  new Date(at).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
export function AssetJournal({
  state,
  assetId,
}: {
  state: State;
  assetId: string;
}) {
  const entries = assetJournal(state, assetId),
    data = entries.map((entry, sequence) => ({ ...entry, sequence }));
  return (
    <details className="asset-journal">
      <summary>잔액 수정 전후 이력 ({entries.length}건)</summary>
      <p>
        수정 시각 기준의 전체 잔액 이력입니다. 이름·분류 변경은 금액 차트를
        바꾸지 않습니다. 같은 평가일을 다시 수정해도 이전 금액을 보존합니다.
        날짜별 차트에는 해당 날짜의 최종 잔액이 표시됩니다.
      </p>
      {!entries.length ? (
        <p>
          이 기능 적용 이후의 잔액 변경부터 저장합니다. 과거 날짜별 잔액은 위
          차트와 상세 기록에서 확인하세요.
        </p>
      ) : (
        <>
          {data.length > 1 && (
            <div
              style={{ height: 180, width: "100%" }}
              role="img"
              aria-label="자산 잔액 수정 이력 차트"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <XAxis
                    dataKey="sequence"
                    tickFormatter={(i) => (data[i] ? stamp(data[i].at) : "")}
                    minTickGap={35}
                  />
                  <YAxis tickFormatter={(value) => won(value)} width={85} />
                  <Tooltip
                    labelFormatter={(i) =>
                      data[Number(i)] ? stamp(data[Number(i)].at) : ""
                    }
                    formatter={(v) => [`${won(Number(v))}원`, "수정 후 잔액"]}
                  />
                  <Line
                    type="linear"
                    dataKey="afterValue"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="journal-scroll">
            <table>
              <thead>
                <tr>
                  <th>수정 시각</th>
                  <th>평가일</th>
                  <th>이전 잔액</th>
                  <th>수정 후 잔액</th>
                </tr>
              </thead>
              <tbody>
                {[...entries].reverse().map((entry) => (
                  <tr key={entry.id}>
                    <td>{stamp(entry.at)}</td>
                    <td>{entry.effectiveDate}</td>
                    <td>
                      {entry.beforeValue == null
                        ? "신규 기록"
                        : `${won(entry.beforeValue)}원`}
                    </td>
                    <td>{won(entry.afterValue!)}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </details>
  );
}
