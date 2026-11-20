import { cashType } from "./cash-types";
import { expensePurpose } from "./expense-purpose";
import ExcelJS from "exceljs";
import { State, totals } from "./domain";
export type ExportTable = {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
};
export function exportTables(s: State): ExportTable[] {
  const t = totals(s),
    names = new Map(s.assets.map((a) => [a.id, a.name]));
  return [
    {
      name: "요약",
      headers: ["항목", "값"],
      rows: [
        ["최종 수정", s.updatedAt],
        ["로컬 버전", s.revision],
        ["자산 합계", t.assets],
        ["부채 합계", t.debt],
        ["순자산", t.net],
        ["월 소득", s.settings.income],
        ["연 소득", s.settings.annualIncome],
        ["안내", "조회용 보고서입니다. 전체 복원에는 JSON 백업을 사용하세요."],
      ],
    },
    {
      name: "자산",
      headers: [
        "ID",
        "이름",
        "유형",
        "현금 세부유형",
        "기관",
        "현재 금액",
        "원금",
        "평가일",
        "사용",
        "삭제일",
      ],
      rows: s.assets.map((a) => [
        a.id,
        a.name,
        a.category,
        a.category === "현금" ? cashType(a) : (a.cashType ?? null),
        a.institution,
        a.value,
        a.principal,
        a.date,
        a.active ? "예" : "아니오",
        a.deletedAt ?? null,
      ]),
    },
    {
      name: "고정지출",
      headers: [
        "ID",
        "이름",
        "분류",
        "세부용도",
        "금액",
        "주기",
        "결제일",
        "계좌",
        "예정일",
        "만기일",
        "메모",
        "사용",
        "삭제일",
      ],
      rows: s.expenses.map((e) => [
        e.id,
        e.name,
        e.category,
        expensePurpose(e),
        e.amount,
        e.cycle,
        e.day,
        e.account,
        e.dueDate ?? null,
        e.maturityDate ?? null,
        e.note ?? null,
        e.active ? "예" : "아니오",
        e.deletedAt ?? null,
      ]),
    },
    {
      name: "대출",
      headers: [
        "ID",
        "이름",
        "원금",
        "금리(%)",
        "기간(개월)",
        "상환방식",
        "월 원금",
        "만기일",
        "금리기준일",
        "확인",
        "사용",
      ],
      rows: s.loans.map((l) => [
        l.id,
        l.name,
        l.principal,
        l.rate,
        l.months,
        l.method,
        l.monthlyPrincipal,
        l.maturity,
        l.rateDate,
        l.verified ? "예" : "아니오",
        l.active ? "예" : "아니오",
      ]),
    },
    {
      name: "자산별 기록",
      headers: [
        "기록일",
        "자산 ID",
        "자산명",
        "금액",
        "출처",
        "확인",
        "원본기준일",
      ],
      rows: [
        ...s.snapshots.flatMap((r) =>
          Object.entries(r.values).map(
            ([id, v]) =>
              [
                r.date,
                id,
                names.get(id) ?? "",
                v,
                "잔액 기록",
                r.confirmed.includes(id) ? "예" : "아니오",
                null,
              ] as (string | number | null)[],
          ),
        ),
        ...(s.assetHistory ?? []).flatMap((r) =>
          Object.entries(r.values).map(
            ([id, v]) =>
              [
                r.date,
                id,
                names.get(id) ?? "",
                v,
                "과거 상세",
                null,
                r.sourceDate ?? null,
              ] as (string | number | null)[],
          ),
        ),
      ],
    },
    {
      name: "순자산 이력",
      headers: ["기록일", "원본기준일", "자산", "부채", "순자산", "메모"],
      rows: [
        ...s.history.map(
          (h) =>
            [
              h.date,
              h.sourceDate,
              h.assets,
              h.debt,
              h.assets - h.debt,
              h.note,
            ] as (string | number | null)[],
        ),
        ...s.snapshots.map((r) => {
          const assets = Object.values(r.values).reduce((a, b) => a + b, 0);
          return [
            r.date,
            null,
            assets,
            r.debt,
            assets - r.debt,
            "잔액 기록",
          ] as (string | number | null)[];
        }),
      ],
    },
    {
      name: "수정 이력",
      headers: [
        "ID",
        "수정시각",
        "내용",
        "대상",
        "항목 ID",
        "필드",
        "수정 전",
        "수정 후",
        "적용일",
      ],
      rows: s.audit.flatMap((a) => {
        if (a.itemChange) {
          const c = a.itemChange,
            before = c.before as Record<string, unknown> | null,
            after = c.after as Record<string, unknown> | null;
          return [
            ...new Set([
              ...Object.keys(before ?? {}),
              ...Object.keys(after ?? {}),
            ]),
          ]
            .filter(
              (k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]),
            )
            .map((k) => [
              a.id,
              a.at,
              a.description,
              c.entity,
              c.itemId,
              k,
              scalar(before?.[k]),
              scalar(after?.[k]),
              a.effectiveDate ?? null,
            ]);
        }
        return [
          [
            a.id,
            a.at,
            a.description,
            a.assetId ? "자산" : null,
            a.assetId ?? null,
            a.assetId ? "금액" : null,
            a.beforeValue ?? null,
            a.afterValue ?? null,
            a.effectiveDate ?? null,
          ],
        ];
      }),
    },
    {
      name: "휴지통",
      headers: ["ID", "종류", "이름", "삭제시각"],
      rows: (s.trash ?? []).map((r) => [r.id, r.entity, r.label, r.deletedAt]),
    },
  ];
}
function scalar(v: unknown): string | number | null {
  return v == null
    ? null
    : typeof v === "number"
      ? v
      : typeof v === "string"
        ? v
        : JSON.stringify(v);
}
export async function excelBuffer(state: State) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FINO";
  workbook.created = new Date(state.updatedAt);
  for (const table of exportTables(state)) {
    const sheet = workbook.addWorksheet(table.name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.addRow(table.headers);
    for (const row of table.rows) sheet.addRow(row);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF087F78" },
    };
    sheet.getRow(1).height = 26;
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, sheet.rowCount), column: table.headers.length },
    };
    sheet.columns.forEach((col, i) => {
      col.width = Math.min(48, Math.max(16, table.headers[i].length * 2 + 4));
      col.numFmt = table.headers[i].includes("금리") ? '0.00"%"' : "#,##0.####";
    });
    sheet.eachRow((row, n) => {
      if (n > 1) {
        row.alignment = { vertical: "top", wrapText: true };
        row.eachCell((c) => {
          if (typeof c.value === "string" && c.value.length > 32767)
            throw Error(
              "엑셀 셀 길이 한도를 초과했습니다. JSON 백업을 사용하세요.",
            );
        });
      }
    });
  }
  return workbook.xlsx.writeBuffer();
}
