import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { migrateSource } from "@/lib/migration";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const source = JSON.parse(
      await readFile(path.join(process.cwd(), ".data/source.json"), "utf8"),
    );
    return NextResponse.json(migrateSource(source), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "검증 가능한 보관본이 없습니다.OAuth 설정 또는 보관본을 확인하세요.",
      },
      { status: 503 },
    );
  }
}
