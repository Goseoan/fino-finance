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
    kind: z.enum(["급여", "상여", "연말정산", "기타"]),
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
    if (p.deletedAt || p.status !== "confirmed" || !p.period) continue;
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
/** Conservative on-device suggestions. Never confirms a record or infers absent amounts. */
export function payrollSuggestions(lines: OCRLine[]) {
  const header = lines
    .filter((l) => l.y > 0.68)
    .map((l) => l.text)
    .join(" ");
  const matches = [
    ...header.matchAll(
      /(20\d{2})\s*[년./-]\s*(0?[1-9]|1[0-2])\s*(?:월|[./-])/g,
    ),
  ];
  const periods = [
    ...new Set(matches.map((m) => `${m[1]}-${m[2].padStart(2, "0")}`)),
  ];
  const find = (labels: string[]) => {
    const candidates: number[] = [];
    for (const l of lines) {
      const clean = l.text.replace(/\s/g, "");
      const label = labels.find((s) => clean.includes(s));
      if (!label || l.confidence < 0.4) continue;
      const parse = (text: string) => {
        const s = text.trim().replace(/[원₩\s]/g, "");
        if (!/^-?(?:\d{1,3}(?:[,.]\d{3})+|\d+)$/.test(s)) return null;
        const n = Number(s.replace(/[,.]/g, ""));
        return Number.isSafeInteger(n) && Math.abs(n) <= 9e12 ? n : null;
      };
      const inline = parse(
        clean.slice(clean.indexOf(label) + label.length).replace(/^[:：]/, ""),
      );
      if (inline !== null) candidates.push(inline);
      else {
        const right = lines
          .filter(
            (r) =>
              r !== l &&
              r.x >= l.x + l.width - 0.015 &&
              Math.abs(r.y + r.height / 2 - (l.y + l.height / 2)) <=
                Math.max(l.height, r.height) * 0.5 &&
              r.confidence >= 0.4,
          )
          .sort((a, b) => a.x - b.x);
        const rightValue = right.length ? parse(right[0].text) : null;
        if (rightValue !== null) candidates.push(rightValue);
        else {
          const below = lines
            .filter(
              (r) =>
                r !== l &&
                r.confidence >= 0.4 &&
                r.y < l.y &&
                l.y - r.y <= Math.max(0.05, l.height * 2.5) &&
                r.x + r.width / 2 >= l.x - 0.01 &&
                r.x + r.width / 2 <= l.x + l.width + 0.01 &&
                parse(r.text) !== null,
            )
            .sort((a, b) => b.y - a.y);
          if (below.length) {
            const nearest = below.filter(
              (r) =>
                Math.abs(r.y - below[0].y) <=
                Math.max(r.height, below[0].height) * 0.5,
            );
            const values = [...new Set(nearest.map((r) => parse(r.text)!))];
            if (values.length === 1) candidates.push(values[0]);
          }
        }
      }
    }
    const unique = [...new Set(candidates)];
    return unique.length === 1 ? unique[0] : null;
  };
  return {
    period: periods.length === 1 ? periods[0] : null,
    gross: find([
      "지급총액",
      "급여총액",
      "지급합계",
      "총지급액",
      "지급액합계",
      "지급액계",
      "지급계",
    ]),
    deducted: find([
      "공제총액",
      "공제합계",
      "총공제액",
      "공제액합계",
      "공제액계",
      "공제계",
    ]),
    net: find([
      "차인지급액",
      "차인지급금액",
      "차인실지급액",
      "실지급액",
      "실수령액",
      "실수령금액",
      "차감지급액",
    ]),
  };
}
