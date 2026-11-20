import { NextRequest, NextResponse } from "next/server";
import { allowedOrigin } from "@/lib/http";
import { GoogleSheetsRepository } from "@/lib/sheets";
import { backupState } from "@/lib/backups";
import { repository } from "@/lib/repository";
import { googleConnectionError } from "@/lib/google-errors";
export async function POST(req: NextRequest) {
  if (!allowedOrigin(req.headers))
    return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403 });
  try {
    const body = await req.json();
    if (body.approved !== true)
      return NextResponse.json(
        { error: "쓰기 범위를 먼저 확인해 주세요" },
        { status: 400 },
      );
    const local = await repository.read().catch(() => null);
    if (local) await backupState(local, "local-before-google-connect");
    if (body.source === "local" && (!local || local.mode === "demo"))
      return NextResponse.json(
        {
          error:
            "이 기기에 실제 작업본이 없습니다. Google 기존 자료를 선택하세요.",
        },
        { status: 400 },
      );
    const state = await new GoogleSheetsRepository().initialize(
      body.source === "local" ? local! : undefined,
    );
    return NextResponse.json({ connected: true, revision: state.revision });
  } catch (e) {
    return NextResponse.json(
      {
        error: googleConnectionError(e),
      },
      { status: 503 },
    );
  }
}
