import { allowedOrigin } from "@/lib/http";
import { payrollForm } from "@/lib/payroll-http";
import { recognizePayroll } from "@/lib/payroll-ocr";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;
export async function POST(request: Request) {
  if (!allowedOrigin(request.headers))
    return Response.json({ error: "허용되지 않은 요청" }, { status: 403 });
  try {
    const form = await payrollForm(request),
      file = form.get("photo");
    if (!file || typeof file === "string") throw Error("사진 필요");
    const suggestions = await recognizePayroll(
      new Uint8Array(await file.arrayBuffer()),
    );
    return Response.json({ suggestions, requiresReview: true });
  } catch {
    return Response.json(
      {
        error:
          "자동 읽기를 완료하지 못했습니다. macOS의 Swift 도구 설치와 사진 상태를 확인하거나 원본을 보며 직접 입력하세요.",
      },
      { status: 422 },
    );
  }
}
