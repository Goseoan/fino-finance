import { NextRequest, NextResponse } from "next/server";
import { allowedOrigin } from "@/lib/http";
import { repository } from "@/lib/repository";
import { saveSnapshot } from "@/lib/domain";
import { mutateState, applyUpdate } from "@/lib/mutations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const state = await repository.read();
    return NextResponse.json(state, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error: "로컬 DB를 읽지 못했습니다. 백업은 유지됩니다.",
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
    const state = await repository.update(mutate);
    return NextResponse.json(state);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return NextResponse.json(
      {
        error: message.includes("충돌")
          ? message
          : "저장하지 못했습니다. 입력값 또는 로컬 DB 상태를 확인하세요. 변경 내용은 화면에 유지됩니다.",
      },
      { status: message.includes("충돌") ? 409 : 400 },
    );
  }
}
