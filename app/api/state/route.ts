import { NextRequest, NextResponse } from "next/server";
import { allowedOrigin } from "@/lib/http";
import { repository } from "@/lib/repository";
import { readGoogleConfig } from "@/lib/google-connection";
import { GoogleSheetsRepository } from "@/lib/sheets";
import { saveSnapshot } from "@/lib/domain";
import { mutateState, applyUpdate } from "@/lib/mutations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function remote() {
  const c = await readGoogleConfig();
  return !!c?.enabled && !c.disabled;
}
export async function GET() {
  try {
    const state = (await remote())
      ? await new GoogleSheetsRepository().read()
      : await repository.read();
    return NextResponse.json(state, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "실제 데이터를 읽지 못했습니다. Google 연결 상태를 확인하세요. 로컬 백업은 유지되며 데모로 자동 전환하지 않습니다.",
      },
      { status: 503 },
    );
  }
}
export async function POST(req: NextRequest) {
  if (!allowedOrigin(req.headers))
    return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403 });
  try {
    const body = await req.json();
    const requestId =
      typeof body.requestId === "string" &&
      /^[\w-]{1,100}$/.test(body.requestId)
        ? body.requestId
        : crypto.randomUUID();
    const mutation = (s: Awaited<ReturnType<typeof repository.read>>) => {
      if (s.mode === "imported") throw Error("읽기 전용 보관본");
      if (body.kind === "snapshot") return saveSnapshot(s, body);
      if (
        [
          "delete",
          "restoreTrash",
          "purgeTrash",
          "clearAll",
          "clearAudit",
        ].includes(body.kind)
      )
        return mutateState(s, body);
      return applyUpdate(s, body);
    };
    const mutate = (s: Parameters<typeof mutation>[0]) =>
      s.lastRequestId === requestId
        ? s
        : { ...mutation(s), lastRequestId: requestId };
    const state = (await remote())
      ? await new GoogleSheetsRepository().update(mutate, requestId)
      : await repository.update(mutate);
    return NextResponse.json(state);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return NextResponse.json(
      {
        error: message.includes("충돌")
          ? message
          : "저장하지 못했습니다. 입력값 또는 Google 연결 상태를 확인하세요. 변경 내용은 화면에 유지됩니다.",
      },
      { status: message.includes("충돌") ? 409 : 400 },
    );
  }
}
