import { NextRequest, NextResponse } from "next/server";
import { allowedOrigin } from "@/lib/http";
import { repository } from "@/lib/repository";
import {
  classificationPreview,
  applyClassification,
  undoClassification,
  lastClassificationBatch,
} from "@/lib/expense-classification";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const s = await repository.read();
    return NextResponse.json(
      {
        revision: s.revision,
        changes: classificationPreview(s),
        undoBatch: lastClassificationBatch(s),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "분류 미리보기를 읽지 못했습니다." },
      { status: 503 },
    );
  }
}
export async function POST(req: NextRequest) {
  if (!allowedOrigin(req.headers))
    return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403 });
  try {
    const b = await req.json();
    if (!Number.isSafeInteger(b.revision)) throw Error("입력 확인");
    const state = await repository.update((s) => {
      if (s.mode === "imported") throw Error("읽기 전용 자료");
      if (
        b.action === "apply" &&
        Array.isArray(b.ids) &&
        b.ids.length <= 500 &&
        b.ids.every((id: unknown) => typeof id === "string")
      )
        return applyClassification(s, b.ids, b.revision, crypto.randomUUID());
      if (
        b.action === "undo" &&
        typeof b.batchId === "string" &&
        b.batchId.length <= 100
      )
        return undoClassification(s, b.batchId, b.revision);
      throw Error("입력 확인");
    });
    return NextResponse.json(state);
  } catch (e) {
    const conflict = e instanceof Error && e.message.includes("충돌");
    return NextResponse.json(
      {
        error: conflict
          ? "저장 충돌: 새로고침 후 분류를 다시 확인하세요."
          : "분류 변경을 저장하지 못했습니다. 대상이나 되돌리기 이력을 확인하세요.",
      },
      { status: conflict ? 409 : 400 },
    );
  }
}
