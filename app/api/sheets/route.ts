import { NextRequest, NextResponse } from "next/server";
import { GoogleSheetsRepository } from "@/lib/sheets";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const repo = new GoogleSheetsRepository();
    if (req.nextUrl.searchParams.get("view") === "data")
      return NextResponse.json(await repo.read(), {
        headers: { "Cache-Control": "no-store" },
      });
    const m = await repo.metadata();
    return NextResponse.json({ title: m.properties?.title, readOnly: false });
  } catch {
    return NextResponse.json(
      {
        error:
          "Google 연결이 필요합니다. /connect에서 OAuth 설정과 로그인을 진행하세요.",
      },
      { status: 503 },
    );
  }
}
