import { payrollRepository } from "@/lib/payroll-repository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params,
      p = payrollRepository.image(id);
    if (!p) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(p.bytes), {
      headers: {
        "Content-Type": p.mime,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
