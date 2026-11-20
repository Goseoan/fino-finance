import { payrollRepository } from "@/lib/payroll-repository";
import { payrollForm, payrollError } from "@/lib/payroll-http";
import { allowedOrigin } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(payrollRepository.read(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "급여 기록을 불러오지 못했습니다." },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  if (!allowedOrigin(request.headers))
    return Response.json({ error: "허용되지 않은 요청" }, { status: 403 });
  try {
    const form = await payrollForm(request),
      revision = Number(form.get("revision"));
    if (!Number.isSafeInteger(revision) || revision < 0)
      throw Error("버전 확인");
    const action = form.get("action");
    let state;
    if (action === "save") {
      const files = form.getAll("photos");
      if (
        files.length > 6 ||
        files.some((f) => typeof f === "string" || f.size > 10 * 1024 * 1024)
      )
        throw Error("사진 확인");
      state = payrollRepository.save(
        JSON.parse(String(form.get("record"))),
        revision,
        await Promise.all(
          files.map((f) =>
            (f as File).arrayBuffer().then((b) => new Uint8Array(b)),
          ),
        ),
      );
    } else if (
      action === "delete" ||
      action === "restore" ||
      action === "purge"
    )
      state = payrollRepository.change(
        String(form.get("id")),
        action,
        revision,
      );
    else throw Error("요청 확인");
    return Response.json(state);
  } catch (e) {
    return payrollError(e);
  }
}
