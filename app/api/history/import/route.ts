import { NextRequest, NextResponse } from "next/server";
import { allowedOrigin } from "@/lib/http";
import { readGoogleConfig } from "@/lib/google-connection";
import { GoogleSheetsRepository } from "@/lib/sheets";
import { mergeHistoricalAssets } from "@/lib/historical-assets";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  if (!allowedOrigin(req.headers))
    return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403 });
  let stage = "configuration";
  try {
    const config = await readGoogleConfig();
    if (!config?.enabled || config.disabled)
      return NextResponse.json(
        { error: "Google 저장소를 먼저 연결하세요." },
        { status: 400 },
      );
    const body = await req.json();
    const repo = new GoogleSheetsRepository();
    stage="read";
    const before = await repo.read();
    const requestId =
      typeof body.requestId === "string" &&
      /^[\w-]{1,100}$/.test(body.requestId)
        ? body.requestId
        : crypto.randomUUID();
    if (body.apply === true && before.lastRequestId === requestId)
      return NextResponse.json({ applied: true, duplicate: true });
    if (body.apply === true && before.revision !== body.revision)
      throw Error("저장 충돌: 미리보기를 다시 확인하세요");
    stage="history-read";
    const parsed = await repo.readHistoricalAssets(before.assets);
    stage="merge";
    const preview = mergeHistoricalAssets(before, parsed.records);
    stage="save";
    if (body.apply === true)
      await repo.update((current) => {
        if (current.lastRequestId === requestId) return current;
        if (current.revision !== body.revision)
          throw Error("저장 충돌: 미리보기를 다시 확인하세요");
        const merged = mergeHistoricalAssets(current, parsed.records).state;
        return merged.revision === current.revision
          ? current
          : { ...merged, lastRequestId: requestId };
      }, requestId);
    return NextResponse.json({
      applied: body.apply === true,
      revision: before.revision,
      dates: preview.dates,
      addedValues: preview.addedValues,
      conflicts: preview.conflicts,
      skippedTabs: parsed.skippedTabs,
      unmatched: parsed.unmatched,
      ambiguous: parsed.ambiguous,
    });
  } catch (error) {
    const conflict = error instanceof Error && error.message.includes("충돌");
    return NextResponse.json(
      {
        diagnostic: {stage,type:error instanceof Error ? error.name : "unknown", runtimeReload: error instanceof TypeError && /not a function/.test(error.message)},
        error: conflict
          ? "저장 충돌: 미리보기를 다시 확인하세요."
          : "과거 기록을 읽거나 저장하지 못했습니다. Google 연결과 관리 탭 형식을 확인하세요.",
      },
      { status: conflict ? 409 : 503 },
    );
  }
}
