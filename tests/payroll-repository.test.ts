import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { PayrollRepository, imageData } from "../lib/payroll-repository";
import { blankPayslip } from "../lib/payroll";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBz0AAAAASUVORK5CYII=",
  "base64",
);
test("payroll photos and audit survive restart, trash restore and archive restore; stale saves roll back", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "fino-payroll-"));
  let r = new PayrollRepository(path.join(dir, "test.sqlite"));
  try {
    const p = blankPayslip();
    let s = r.save(p, 0, [png]);
    const id = s.records[0].imageIds[0];
    assert.equal(s.audit.length, 1);
    assert.deepEqual(r.image(id)!.bytes, png);
    s = r.save(s.records[0], s.revision);
    assert.equal(s.audit.length, 1);
    assert.throws(() => r.save(p, 0), /충돌/);
    r.close();
    r = new PayrollRepository(path.join(dir, "test.sqlite"));
    s = r.read();
    assert.equal(s.records.length, 1);
    const archive = r.archive();
    s = r.change(p.id, "delete", s.revision);
    s = r.change(p.id, "restore", s.revision);
    assert.equal(s.records[0].deletedAt, undefined);
    s = r.change(p.id, "delete", s.revision);
    s = r.change(p.id, "purge", s.revision);
    assert.equal(s.records.length, 0);
    assert.equal(r.image(id), null);
    s = r.restore(archive, s.revision);
    assert.equal(s.records.length, 1);
    assert.deepEqual(r.image(id)!.bytes, png);
    assert.throws(() => r.restore({ ...archive, images: [] }, s.revision));
    assert.equal(r.read().revision, s.revision);
    assert.throws(() => imageData(Buffer.from("<svg/>")));
  } finally {
    r.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
