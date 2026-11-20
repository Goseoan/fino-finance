import { NextResponse } from "next/server";
import { repository } from "@/lib/repository";
import { readGoogleConfig } from "@/lib/google-connection";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const s = await repository.read(),
      c = await readGoogleConfig().catch(() => null);
    return NextResponse.json(
      {
        provider: "SQLite",
        revision: s.revision,
        counts: {
          assets: s.assets.length,
          expenses: s.expenses.length,
          loans: s.loans.length,
          audit: s.audit.length,
        },
        authorized: !!c?.tokens?.refresh_token && !c.disabled,
        lastTransfer: repository.lastTransfer(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "로컬 저장 상태를 확인하지 못했습니다." },
      { status: 503 },
    );
  }
}
