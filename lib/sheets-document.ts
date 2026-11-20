import { createHash } from "node:crypto";
import { State, stateSchema } from "./domain";
export const APP_SHEET = "08_앱데이터";
export const ORIGINAL_ID = process.env.GOOGLE_PROTECTED_SPREADSHEET_ID || "protected-source-spreadsheet";
export function assertWriteTarget(id: string, name: string) {
  if (id === ORIGINAL_ID || name !== APP_SHEET)
    throw Error("원본 또는 앱 전용 범위 밖에는 쓸 수 없습니다");
}
export function encodeDocument(
  state: State,
  requestId: string,
): (string | number)[][] {
  const s = stateSchema.parse(state);
  const json = JSON.stringify(s);
  if (json.length > 3_000_000)
    throw Error("앱 데이터가 너무 큽니다. 백업 후 오래된 휴지통을 정리하세요");
  const rows: (string | number)[][] = [
    [
      "FINO_STATE_V1",
      s.revision,
      requestId,
      createHash("sha256").update(json).digest("hex"),
    ],
  ];
  let i = 0;
  while (i < json.length) {
    let end = Math.min(i + 30000, json.length);
    const code = json.charCodeAt(end - 1);
    if (code >= 0xd800 && code <= 0xdbff && end < json.length) end--;
    rows.push([json.slice(i, end)]);
    i = end;
  }
  return rows;
}
export function decodeDocument(rows: unknown[][]) {
  if (!rows.length || !rows[0]?.length) return null;
  if (rows[0][0] !== "FINO_STATE_V1")
    throw Error("앱 탭에 알 수 없는 데이터가 있습니다. 덮어쓰지 않습니다");
  const json = rows
    .slice(1)
    .map((r) => String(r[0] ?? ""))
    .join("");
  if (createHash("sha256").update(json).digest("hex") !== rows[0][3])
    throw Error("Google 데이터 검증 실패: 체크섬 불일치");
  const state = stateSchema.parse(JSON.parse(json));
  if (state.revision !== Number(rows[0][1]))
    throw Error("Google 데이터 revision 불일치");
  return { state, requestId: String(rows[0][2] ?? "") };
}
