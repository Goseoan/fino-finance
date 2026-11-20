import { NextRequest, NextResponse } from "next/server";
import { allowedOrigin } from "@/lib/http";
import { readGoogleConfig, storeGoogleConfig } from "@/lib/google-connection";
export const dynamic = "force-dynamic";
export async function GET() {
  const c = await readGoogleConfig();
  return NextResponse.json(
    {
      configured: !!c && !c.disabled,
      authorized: !!c?.tokens?.refresh_token && !c.disabled,
      enabled: !!c?.enabled && !c.disabled,
      clientId: c?.clientId ?? "",
      spreadsheetId: c?.spreadsheetId ?? "",
      redirectUri: c?.redirectUri ?? "",
      writeRange: "08_앱데이터!A1:D5000",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: NextRequest) {
  if (!allowedOrigin(req.headers))
    return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403 });
  try {
    await storeGoogleConfig(await req.json());
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "클라이언트 정보, 복사본 ID와 콜백 주소를 확인하세요. 원본은 쓰기 대상으로 선택할 수 없습니다.",
      },
      { status: 400 },
    );
  }
}
