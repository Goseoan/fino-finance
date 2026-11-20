import { NextRequest, NextResponse } from "next/server";
import { repository } from "@/lib/repository";
import { GoogleSheetsRepository } from "@/lib/sheets";
import { googleClient, readGoogleConfig } from "@/lib/google-connection";
import { allowedOrigin } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  if (!allowedOrigin(req.headers))
    return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403 });
  try {
    const b = await req.json(),
      c = await readGoogleConfig();
    if (!c?.tokens?.refresh_token || c.disabled)
      throw Error("Google 인증이 필요합니다");
    const remote = new GoogleSheetsRepository(googleClient, async () => {});
    const local = await repository.read();
    if (b.action === "preview")
      return NextResponse.json({
        ...(await remote.previewExport()),
        localRevision: local.revision,
        counts: {
          assets: local.assets.length,
          expenses: local.expenses.length,
          loans: local.loans.length,
          audit: local.audit.length,
        },
      });
    if (
      b.action !== "push" ||
      b.approved !== true ||
      !/^manual-[\w-]{1,80}$/.test(b.operationId) ||
      !(b.fingerprint === null || typeof b.fingerprint === "string")
    )
      return NextResponse.json(
        { error: "전송 범위와 미리보기를 확인하세요." },
        { status: 400 },
      );
    const previous = repository.transfer(b.operationId);
    if (previous) return NextResponse.json({ sent: true, ...previous });
    if (local.revision !== b.localRevision)
      return NextResponse.json(
        { error: "로컬 저장 충돌: 미리보기를 다시 확인하세요." },
        { status: 409 },
      );
    const result = await remote.exportLocal(
      local,
      b.fingerprint,
      b.operationId,
    );
    repository.recordTransfer(b.operationId, local.revision, result.revision);
    return NextResponse.json({
      sent: true,
      revision: local.revision,
      remoteRevision: result.revision,
    });
  } catch (e) {
    const conflict = e instanceof Error && e.message.includes("충돌");
    return NextResponse.json(
      {
        error: conflict
          ? "Google 저장 충돌: 미리보기를 다시 확인하세요."
          : "Google 전송에 실패했습니다. 인증·대상·쓰기 소유권을 확인하세요. 로컬 DB는 유지됩니다.",
      },
      { status: conflict ? 409 : 503 },
    );
  }
}
