import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json(
    {
      error: "저장소는 SQLite입니다. 설정의 Google 전송 미리보기를 사용하세요.",
    },
    { status: 409 },
  );
}
