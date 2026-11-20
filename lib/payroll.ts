import { z } from "zod";
export const payrollMoney = z
  .number()
  .int()
  .min(-9_000_000_000_000)
  .max(9_000_000_000_000);
export const payrollEntrySchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().trim().min(1).max(80),
  amount: payrollMoney.nullable(),
  group: z.string().max(40).optional(),
});
export const payrollSchema = z
  .object({
    id: z.string().min(1).max(100),
    title: z.string().trim().min(1).max(100),
    period: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .nullable(),
    paymentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (v) =>
          !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
      )
      .nullable(),
    kind: z.enum(["급여", "상여", "연말정산", "연간소득", "퇴직금", "기타"]),
    referenceYear: z.number().int().min(1900).max(2200).nullable().optional(),
    referenceDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    referenceValues: z
      .array(
        payrollEntrySchema.extend({
          amount: z.number().finite().min(-9e12).max(9e12).nullable(),
          unit: z.string().max(20).optional(),
        }),
      )
      .max(80)
      .optional(),
    employer: z.string().max(100),
    status: z.enum(["draft", "confirmed"]),
    earnings: z.array(payrollEntrySchema).max(80),
    deductions: z.array(payrollEntrySchema).max(80),
    gross: payrollMoney.nullable(),
    deducted: payrollMoney.nullable(),
    net: payrollMoney.nullable(),
    imageIds: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(6),
    note: z.string().max(2000),
    source: z.enum(["manual", "google-sheet"]),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().optional(),
  })
  .superRefine((p, ctx) => {
    for (const entries of [p.earnings, p.deductions])
      if (new Set(entries.map((e) => e.id)).size !== entries.length)
        ctx.addIssue({ code: "custom", message: "중복 급여 항목 ID" });
    if (new Set(p.imageIds).size !== p.imageIds.length)
      ctx.addIssue({ code: "custom", message: "중복 사진" });
    if (p.status !== "confirmed") return;
    if (p.kind === "연간소득" || p.kind === "퇴직금") {
      if (
        p.period !== null ||
        p.gross !== null ||
        p.deducted !== null ||
        p.net !== null
      )
        ctx.addIssue({
          code: "custom",
          message: "연간소득·퇴직금 참고자료는 월급 총액과 구분해 저장하세요",
        });
      if (
        (!p.referenceYear && !p.referenceDate) ||
        !p.referenceValues?.length ||
        p.referenceValues.some((r) => r.amount === null)
      )
        ctx.addIssue({
          code: "custom",
          message: "참고 기준일/연도와 분석한 참고 항목을 입력하세요",
        });
      return;
    }

    if (
      !p.period ||
      p.gross === null ||
      p.deducted === null ||
      p.net === null
    ) {
      ctx.addIssue({
        code: "custom",
        message: "확정하려면 귀속월·지급·공제·실수령액을 입력하세요",
      });
      return;
    }
    if (p.gross - p.deducted !== p.net)
      ctx.addIssue({
        code: "custom",
        message: "지급액 - 공제액과 실수령액이 일치하지 않습니다",
      });
    for (const [rows, total] of [
      [p.earnings, p.gross],
      [p.deductions, p.deducted],
    ] as const)
      if (
        rows.length &&
        (rows.some((r) => r.amount === null) ||
          rows.reduce((sum, r) => sum + (r.amount ?? 0), 0) !== total)
      )
        ctx.addIssue({
          code: "custom",
          message: "세부 항목 합계가 총액과 일치하지 않습니다",
        });
  });
export type Payslip = z.infer<typeof payrollSchema>;
export type PayrollImage = { id: string; mime: string; bytes: Uint8Array };
export type PayrollEvent = {
  id: string;
  at: string;
  recordId: string;
  action: string;
  before: Payslip | null;
  after: Payslip | null;
};
export type PayrollState = {
  revision: number;
  records: Payslip[];
  audit: PayrollEvent[];
};
export function blankPayslip(): Payslip {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "급여명세서",
    period: null,
    paymentDate: null,
    kind: "급여",
    employer: "",
    status: "draft",
    earnings: [],
    deductions: [],
    gross: null,
    deducted: null,
    net: null,
    imageIds: [],
    note: "",
    source: "manual",
    createdAt: now,
    updatedAt: now,
  };
}
export function payrollMonthly(records: Payslip[]) {
  const months = new Map<
    string,
    {
      period: string;
      gross: number;
      deducted: number;
      net: number;
      count: number;
    }
  >();
  for (const p of records) {
    if (
      p.deletedAt ||
      p.status !== "confirmed" ||
      !p.period ||
      isPayrollReference(p)
    )
      continue;
    const r = months.get(p.period) ?? {
      period: p.period,
      gross: 0,
      deducted: 0,
      net: 0,
      count: 0,
    };
    r.gross += p.gross!;
    r.deducted += p.deducted!;
    r.net += p.net!;
    r.count++;
    months.set(p.period, r);
  }
  return [...months.values()].sort((a, b) => a.period.localeCompare(b.period));
}
export type OCRLine = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};
/** Suggestions are structured data; source totals and every item must still be reconciled. */
export function payrollSuggestions(lines: OCRLine[]) {
  const normalized = (s: string) =>
    s
      .normalize("NFKC")
      .replace(/[\s·:：()（）\[\]{}]/g, "")
      .replace(/^[|｜]+/, "");
  const text = lines.map((l) => normalized(l.text)).join(" ");
  const kind: Payslip["kind"] | null =
    /개인별퇴직금|법정퇴직금|퇴직금예상|평균임금/.test(text)
      ? "퇴직금"
      : /근로소득지급명세서|근로소득원천징수|원천징수영수증/.test(text)
        ? "연간소득"
        : /월급여명세표|월급여명세서|급여명세서|급여명세표/.test(text)
          ? "급여"
          : null;
  const header = lines
    .filter((l) => l.y > 0.68)
    .map((l) => l.text)
    .join(" ");
  const dateMatches = [
    ...header.matchAll(
      /(20\d{2})\s*[년./-]\s*(0?[1-9]|1[0-2])\s*[월./-]\s*(0?[1-9]|[12]\d|3[01])(?:일|\b)/g,
    ),
  ];
  const dates = [
    ...new Set(
      dateMatches.map(
        (m) => `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`,
      ),
    ),
  ].filter(
    (d) =>
      !isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d,
  );
  const periodMatches = [
    ...header.matchAll(
      /(20\d{2})\s*[년./-]\s*(0?[1-9]|1[0-2])\s*(?:월|[./-])/g,
    ),
  ];
  const periods = [
    ...new Set(periodMatches.map((m) => `${m[1]}-${m[2].padStart(2, "0")}`)),
  ];
  const parse = (s: string): number | null => {
    let value = s.replace(/[원₩\s]/g, "");
    if (/^\(.*\)$/.test(value)) value = "-" + value.slice(1, -1);
    if (!/^-?(?:\d{1,3}(?:[,.]\d{3})+|\d+)$/.test(value)) return null;
    const n = Number(value.replace(/[,.]/g, ""));
    return Number.isSafeInteger(n) && Math.abs(n) <= 9e12 ? n : null;
  };
  const anchors = lines.filter((l) =>
    ["갑근세", "주민세", "국민연금", "건강보험료"].some((k) =>
      normalized(l.text).startsWith(k),
    ),
  );
  const split = anchors.length
    ? Math.min(...anchors.map((l) => l.x)) - 0.015
    : 0.5;
  const find = (labels: string[], side?: "earnings" | "deductions") => {
    const values: number[] = [];
    for (const line of lines) {
      const clean = normalized(line.text);
      const label = labels.find((k) => clean.startsWith(normalized(k)));
      if (!label || line.confidence < 0.25) continue;
      if (
        (side === "earnings" && line.x >= split) ||
        (side === "deductions" && line.x < split - 0.03)
      )
        continue;
      const tail = clean
        .slice(normalized(label).length)
        .replace(/^[ABC](?=[-\d])/, "");
      const inline = parse(tail);
      if (inline !== null) {
        values.push(inline);
        continue;
      }
      const right = lines
        .filter(
          (r) =>
            r !== line &&
            r.x >= line.x + line.width - 0.015 &&
            Math.abs(r.y + r.height / 2 - line.y - line.height / 2) <=
              Math.max(line.height, r.height) * 0.7 &&
            r.confidence >= 0.4 &&
            parse(r.text) !== null &&
            (!side || side === "earnings"
              ? !side || r.x < split
              : r.x >= split),
        )
        .sort((a, b) => a.x - b.x);
      if (right.length) {
        values.push(parse(right[0].text)!);
        continue;
      }
      if (side) continue;
      const below = lines
        .filter(
          (r) =>
            r !== line &&
            r.confidence >= 0.4 &&
            r.y < line.y &&
            line.y - r.y <= Math.max(0.05, line.height * 2.5) &&
            r.x + r.width / 2 >= line.x - 0.01 &&
            r.x + r.width / 2 <= line.x + line.width + 0.01 &&
            parse(r.text) !== null,
        )
        .sort((a, b) => b.y - a.y);
      if (below.length) {
        const near = below.filter(
          (r) =>
            Math.abs(r.y - below[0].y) <=
            Math.max(r.height, below[0].height) * 0.5,
        );
        const options = [...new Set(near.map((r) => parse(r.text)!))];
        if (options.length === 1) values.push(options[0]);
      }
    }
    const unique = [...new Set(values)];
    return unique.length === 1 ? unique[0] : null;
  };
  const reference = kind === "연간소득" || kind === "퇴직금";
  const earningLabels = [
    "본봉",
    "업무수당",
    "직무추진수당",
    "조사연구수당",
    "전산업무수당",
    "시간외근무수당",
    "자기계발수당",
    "감정수당",
    "정기상여금",
    "교통보조비",
    "중식대",
    "비과세중식대",
    "직원복지연금(은행)",
    "정기단련비",
  ];
  const deductionLabels = [
    "갑근세",
    "주민세",
    "국민연금",
    "건강보험료",
    "장기요양보험료",
    "고용보험료",
    "신협출자금",
    "직원복지연금(본인)",
    "직원복지연금(회사)",
    "소비조합물품대",
    "중식대공제액",
    "노조회비",
    "행우회비",
    "노조지부활동비",
    "기부금",
    "우리사주",
    "끝전모으기",
  ];
  const entries = (labels: string[], side: "earnings" | "deductions") =>
    labels.flatMap((label) => {
      const aliases: Record<string, string[]> = {
        자기계발수당: ["사기계발수당"],
        중식대: ["중식때"],
        신협출자금: ["신협불입금"],
        행우회비: ["햄우회비"],
      };
      const amount = find([label, ...(aliases[label] ?? [])], side);
      return amount === null
        ? []
        : [
            {
              id: crypto.randomUUID(),
              label,
              amount,
              group:
                side === "earnings"
                  ? earningLabels.indexOf(label) < 9
                    ? "보수"
                    : "후생비"
                  : /갑근세|주민세/.test(label)
                    ? "세금"
                    : /국민연금|보험료/.test(label)
                      ? "사회보험"
                      : /복지연금|우리사주/.test(label)
                        ? "연금·투자"
                        : "기타공제",
            },
          ];
    });
  const gross = reference
    ? null
    : find([
        "지급총계",
        "지금총계",
        "지급총액",
        "급여총액",
        "지급합계",
        "총지급액",
        "지급액합계",
      ]);
  const deducted = reference
    ? null
    : find(["공제총계", "공제총액", "공제합계", "총공제액", "공제액합계"]);
  const net = reference
    ? null
    : find([
        "통장입금액",
        "차인지급액",
        "차인지급금액",
        "차인실지급액",
        "실지급액",
        "실수령액",
        "실수령금액",
      ]);
  return {
    period: reference ? null : periods.length === 1 ? periods[0] : null,
    paymentDate: reference ? null : dates.length === 1 ? dates[0] : null,
    kind,
    gross,
    deducted,
    net,
    earnings: reference ? [] : entries(earningLabels, "earnings"),
    deductions: reference ? [] : entries(deductionLabels, "deductions"),
    documentType: reference
      ? "reference"
      : kind === "급여"
        ? "monthly"
        : "unknown",
  };
}
export const isPayrollReference = (p: Pick<Payslip, "kind">) =>
  p.kind === "연간소득" || p.kind === "퇴직금";
export function payrollComparison(records: Payslip[]) {
  const active = records.filter(
    (p) =>
      !p.deletedAt &&
      p.status === "confirmed" &&
      !isPayrollReference(p) &&
      p.period,
  );
  const periods = [...new Set(active.map((p) => p.period!))].sort();
  const rows = new Map<
    string,
    {
      type: string;
      group: string;
      label: string;
      values: Record<string, number | null>;
    }
  >();
  for (const p of active)
    for (const [type, entries] of [
      ["지급", p.earnings],
      ["공제", p.deductions],
    ] as const)
      for (const e of entries) {
        const key = `${type}:${e.group ?? ""}:${e.label.normalize("NFC").trim()}`;
        const row = rows.get(key) ?? {
          type,
          group: e.group ?? "",
          label: e.label,
          values: {},
        };
        const old = row.values[p.period!];
        row.values[p.period!] =
          e.amount === null || old === null ? null : (old ?? 0) + e.amount;
        rows.set(key, row);
      }
  return { periods, rows: [...rows.values()] };
}
export function payrollAnalysisSummary(
  p: Pick<Payslip, "earnings" | "deductions" | "gross" | "deducted" | "net">,
) {
  const sum = (rows: Payslip["earnings"]) =>
    rows.length && rows.every((r) => r.amount !== null)
      ? rows.reduce((a, r) => a + r.amount!, 0)
      : null;
  const earned = sum(p.earnings),
    deducted = sum(p.deductions);
  return {
    earningItems: p.earnings.length,
    deductionItems: p.deductions.length,
    earningsMatch: earned !== null && earned === p.gross,
    deductionsMatch: deducted !== null && deducted === p.deducted,
    netMatches:
      p.gross !== null &&
      p.deducted !== null &&
      p.net !== null &&
      p.gross - p.deducted === p.net,
  };
}
