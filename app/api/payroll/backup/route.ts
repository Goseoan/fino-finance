import { payrollRepository } from "@/lib/payroll-repository";
import { allowedOrigin } from "@/lib/http";
import { limitedBytes, payrollError } from "@/lib/payroll-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const json=JSON.stringify(payrollRepository.archive());
    if(Buffer.byteLength(json)>95*1024*1024) return Response.json({error:"사진 포함 급여 백업이 95MB를 초과했습니다. 서버를 종료한 후 SQLite DB와 WAL/SHM을 함께 백업하세요."},{status:413});
    return new Response(json, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Content-Disposition":
          'attachment; filename="fino-payroll-backup.json"',
      },
    });
  } catch {
    return Response.json(
      { error: "급여 백업을 만들지 못했습니다." },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  if (!allowedOrigin(request.headers))
    return Response.json({ error: "허용되지 않은 요청" }, { status: 403 });
  try {
    const b = JSON.parse(
      (await limitedBytes(request, 100 * 1024 * 1024)).toString("utf8"),
    );
    if (!Number.isSafeInteger(b.revision) || b.approved !== true)
      throw Error("복원 범위 확인");
    return Response.json(payrollRepository.restore(b.archive, b.revision));
  } catch (e) {
    return payrollError(e);
  }
}
