"use client";
import { type Payslip, payrollComparison } from "@/lib/payroll";
import { won } from "@/lib/domain";
export function PayrollComparison({ records }: { records: Payslip[] }) {
  const { periods, rows } = payrollComparison(records);
  if (!rows.length) return null;
  const last = periods.at(-1)!,
    prior = periods.at(-2);
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>지급·공제 항목별 비교</h2>
          <p>
            원본에서 분석한 세부 내역입니다. 미기재 항목은 0원으로 가정하지
            않습니다. 증감은 이전에 등록된 시점과 비교합니다.
          </p>
        </div>
      </div>
      <div
        className="payroll-comparison"
        role="region"
        aria-label="지급 공제 항목 비교"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>항목</th>
              {periods.map((p) => (
                <th key={p}>{p}</th>
              ))}
              {prior && <th>이전 기록 대비</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const a = prior ? r.values[prior] : null,
                b = r.values[last],
                delta = a != null && b != null ? b - a : null;
              return (
                <tr key={i}>
                  <th scope="row">
                    <small>
                      {r.type}
                      {r.group ? ` · ${r.group}` : ""}
                    </small>
                    {r.label}
                  </th>
                  {periods.map((p) => (
                    <td key={p}>
                      {r.values[p] == null
                        ? "미기재"
                        : won(r.values[p]!) + "원"}
                    </td>
                  ))}
                  {prior && (
                    <td>
                      {delta === null
                        ? "—"
                        : (delta > 0 ? "+" : "") + won(delta) + "원"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
