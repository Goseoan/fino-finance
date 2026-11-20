import { NextRequest, NextResponse } from "next/server";
import { allowedOrigin } from "@/lib/http";
import { disconnectGoogle } from "@/lib/google-connection";
export async function POST(req: NextRequest) {
  if (!allowedOrigin(req.headers))
    return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403 });
  try {
    await disconnectGoogle();
    return NextResponse.json({ disconnected: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "연결 해제에 실패했습니다. 저장 중인 작업이 끝난 뒤 다시 시도하세요.",
      },
      { status: 409 },
    );
  }
}
