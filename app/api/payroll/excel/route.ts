import { payrollRepository } from "@/lib/payroll-repository";
import { payrollExportTables } from "@/lib/payroll-export";
import { excelTablesBuffer } from "@/lib/excel-export";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const buffer = await excelTablesBuffer(
      payrollExportTables(payrollRepository.read()),
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="fino-payroll.xlsx"',
      },
    });
  } catch {
    return Response.json(
      {
        error:
          "급여 엑셀을 만들지 못했습니다. 사진 포함 급여 백업을 사용하세요.",
      },
      { status: 503 },
    );
  }
}
