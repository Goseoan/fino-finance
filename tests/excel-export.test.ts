import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { excelBuffer, exportTables } from "../lib/excel-export";
import { seedState } from "../lib/domain";
test("Excel exports numeric zero, blank unknown and safe literal text with complete histories", async () => {
  const s = seedState();
  s.assets[0].name = '=HYPERLINK("https://example.invalid")';
  s.assets[0].value = 0;
  s.assets[0].principal = null;
  const data = await excelBuffer(s),
    workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  assert.equal(workbook.worksheets.length, 8);
  const a = workbook.getWorksheet("자산")!;
  assert.equal(a.getCell("B2").value, s.assets[0].name);
  assert.equal(a.getCell("F2").value, 0);
  assert.equal(a.getCell("G2").value, null);
  assert.equal(
    workbook.getWorksheet("자산별 기록")!.rowCount,
    exportTables(s).find((t) => t.name === "자산별 기록")!.rows.length + 1,
  );
  assert.equal(a.views[0].state, "frozen");
  assert.equal(workbook.creator, "FINO");
});
