import { repository } from "@/lib/repository";
import { excelBuffer } from "@/lib/excel-export";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const s = await repository.read(),
      buffer = await excelBuffer(s);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="fino-${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        error:
          "엑셀 내보내기에 실패했습니다. JSON 백업을 이용하거나 기록 크기를 확인하세요.",
      },
      { status: 503 },
    );
  }
}
