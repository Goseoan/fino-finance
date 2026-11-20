"use client";
import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { type State, won } from "@/lib/domain";
import {
  itemJournal,
  journalMetric,
  ITEM_METRICS,
  changedItemFields,
  type ItemEntity,
} from "@/lib/item-journal";
import { cashflowLabel } from "@/lib/classification";
import { Modal } from "./ui/modal";
const stamp = (at: string) =>
  new Date(at).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
function display(value: unknown, key: string, entity: ItemEntity) {
  if (value == null || value === "")
    return key === "purpose" ? "자동 분류" : "미지정";
  if (typeof value === "boolean")
    return key === "verified"
      ? value
        ? "확인"
        : "미확인"
      : value
        ? "활성"
        : entity === "loan"
          ? "상환 완료"
          : "중지";
  if (["amount", "principal", "monthlyPrincipal"].includes(key))
    return `${won(Number(value))}원`;
  if (key === "rate") return `${value}%`;
  if (key === "months") return `${value}개월`;
  if (key === "day") return `${value}일`;
  if (key === "category") return cashflowLabel(String(value));
  return String(value);
}
export function ItemHistory({
  state,
  entity,
  itemId,
  onClose,
}: {
  state: State;
  entity: ItemEntity;
  itemId: string;
  onClose: () => void;
}) {
  const entries = itemJournal(state, entity, itemId),
    item = (entity === "expense" ? state.expenses : state.loans).find(
      (item) => item.id === itemId,
    );
  const [metric, setMetric] = useState<string>(ITEM_METRICS[entity][0].key);
  const selected =
    ITEM_METRICS[entity].find((m) => m.key === metric) ??
    ITEM_METRICS[entity][0];
  const data = [
    ...(entries[0]?.before
      ? [
          {
            label: "첫 수정 전",
            value: journalMetric(entries[0], metric, "before"),
            baseline: true,
          },
        ]
      : []),
    ...entries.map((e) => ({
      label: stamp(e.at),
      value: journalMetric(e, metric, "after"),
      baseline: false,
    })),
  ].map((p, sequence) => ({ ...p, sequence }));
  const label = entity === "expense" ? "고정지출" : "대출";
  const format = (value: number) =>
    selected.unit === "원" ? `${won(value)}원` : `${value}${selected.unit}`;
  return (
    <Modal title={`${item?.name ?? label} 수정 이력·추이`} onClose={onClose}>
      <div className="item-history">
        <p className="item-history-note">
          이 기능 적용 이후의 등록·수정부터 저장합니다. 수정 순서 기준이며 첫
          수정 전 값의 과거 시각은 추정하지 않습니다. 현재 값만으로 과거 이력을
          만들지 않습니다.
        </p>
        <label className="item-history-metric">
          추이 지표
          <select
            aria-label={`${label} 추이 지표`}
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            {ITEM_METRICS[entity].map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <p className="item-history-note">
          {entity === "expense"
            ? "월 환산 납부액은 당시 납부주기로 계산한 금액입니다. 중지 여부와 실제 출금액은 별도로 확인하세요."
            : "예상 월 상환액은 당시 입력한 조건으로 계산합니다. 기간 등 필수 정보가 미확인이면 빈 값으로 남기며 0으로 바꾸지 않습니다."}
        </p>
        {data.filter((p) => p.value !== null).length >= 2 ? (
          <div
            className="item-history-chart"
            role="img"
            aria-label={`${label} ${selected.label} 변경 추이`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 12, right: 16, bottom: 10, left: 0 }}
              >
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="sequence"
                  type="category"
                  tickFormatter={(index) =>
                    data[index]?.baseline
                      ? "첫 수정 전"
                      : (data[index]?.label.slice(6) ?? "")
                  }
                  minTickGap={40}
                />
                <YAxis
                  width={95}
                  tickFormatter={(value) =>
                    selected.unit === "원" ? won(value) : String(value)
                  }
                />
                <Tooltip
                  labelFormatter={(index) => data[Number(index)]?.label ?? ""}
                  formatter={(value) => [
                    value == null ? "미확인" : format(Number(value)),
                    selected.label,
                  ]}
                />
                <Line
                  type="stepAfter"
                  dataKey="value"
                  connectNulls={false}
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty">
            {entries.length
              ? "이 지표의 확인 가능한 기록이 아직 부족합니다."
              : "아직 수정 이력이 없습니다. 항목을 수정해 저장하면 이곳에 기록됩니다."}
          </div>
        )}
        <h3>수정 전후 상세 ({entries.length}건)</h3>
        <div className="item-history-records">
          {[...entries].reverse().map((event) => (
            <section key={event.id} className="item-history-record">
              <h4>
                <time dateTime={event.at}>{stamp(event.at)}</time>
                <span className="tag">{event.action}</span>
              </h4>
              <div className="journal-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>변경 항목</th>
                      <th>이전</th>
                      <th>이후</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changedItemFields(event).map((field) => (
                      <tr key={field.key}>
                        <th scope="row">{field.label}</th>
                        <td>{display(field.before, field.key, entity)}</td>
                        <td>{display(field.after, field.key, entity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
        <p className="item-history-note">
          항목 삭제는 이력을 보관하고, 복원하면 다시 볼 수 있습니다. 영구삭제 시
          연결된 이력도 정리됩니다. 설정에서 수정 이력을 지우면 이 차트의 기록도
          삭제됩니다.
        </p>
      </div>
    </Modal>
  );
}
