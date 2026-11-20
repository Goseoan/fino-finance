import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, chmodSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  type Payslip,
  type PayrollEvent,
  type PayrollState,
  payrollSchema,
} from "./payroll";
export const PAYROLL_IMAGE_LIMIT = 10 * 1024 * 1024;
export function imageData(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > PAYROLL_IMAGE_LIMIT)
    throw Error("사진은 10MB 이하만 등록할 수 있습니다");
  const b = Buffer.from(bytes);
  let mime = "";
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) mime = "image/jpeg";
  else if (
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    mime = "image/png";
  else if (
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  )
    mime = "image/webp";
  else throw Error("JPG·PNG·WebP 사진만 등록할 수 있습니다");
  return { id: createHash("sha256").update(b).digest("hex"), mime, bytes: b };
}
const eventSchema = z.object({
  id: z.string(),
  at: z.string(),
  recordId: z.string(),
  action: z.string(),
  before: payrollSchema.nullable(),
  after: payrollSchema.nullable(),
});
const archiveSchema = z.object({
  format: z.literal("FINO_PAYROLL_BACKUP_V1"),
  records: z.array(payrollSchema).max(5000),
  audit: z.array(eventSchema).max(50000),
  images: z
    .array(z.object({ id: z.string(), data: z.string().max(14_000_000) }))
    .max(5000),
});
export class PayrollRepository {
  private db?: DatabaseSync;
  constructor(
    private file = path.join(
      process.cwd(),
      ".data",
      process.env.FINANCE_E2E ? "e2e.sqlite" : "finance.sqlite",
    ),
  ) {}
  private open() {
    if (this.db) return this.db;
    mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(this.file);
    chmodSync(this.file, 0o600);
    db.exec(`PRAGMA busy_timeout=5000;PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;
 CREATE TABLE IF NOT EXISTS payroll_meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL);
 INSERT OR IGNORE INTO payroll_meta VALUES(1,0);
 CREATE TABLE IF NOT EXISTS payroll_records(id TEXT PRIMARY KEY,document TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS payroll_images(id TEXT PRIMARY KEY,mime TEXT NOT NULL,bytes BLOB NOT NULL);
 CREATE TABLE IF NOT EXISTS payroll_audit(id TEXT PRIMARY KEY,record_id TEXT NOT NULL,at TEXT NOT NULL,document TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS payroll_audit_record ON payroll_audit(record_id,at);`);
    this.db = db;
    return db;
  }
  read(): PayrollState {
    const db = this.open();
    return {
      revision: Number(
        db.prepare("SELECT revision FROM payroll_meta WHERE id=1").get()!
          .revision,
      ),
      records: db
        .prepare("SELECT document FROM payroll_records ORDER BY rowid DESC")
        .all()
        .map((r) => payrollSchema.parse(JSON.parse(String(r.document)))),
      audit: db
        .prepare("SELECT document FROM payroll_audit ORDER BY rowid DESC")
        .all()
        .map((r) => eventSchema.parse(JSON.parse(String(r.document)))),
    };
  }
  image(id: string) {
    if (!/^[a-f0-9]{64}$/.test(id)) return null;
    const row = this.open()
      .prepare("SELECT mime,bytes FROM payroll_images WHERE id=?")
      .get(id);
    return row
      ? { mime: String(row.mime), bytes: Buffer.from(row.bytes as Uint8Array) }
      : null;
  }
  private transaction(revision: number, fn: (s: PayrollState) => void) {
    const db = this.open();
    db.exec("BEGIN IMMEDIATE");
    try {
      const s = this.read();
      if (s.revision !== revision)
        throw Error("저장 충돌: 명세서를 새로고침해 주세요");
      fn(s);
      db.prepare(
        "UPDATE payroll_meta SET revision=revision+1 WHERE id=1",
      ).run();
      db.exec("COMMIT");
      return this.read();
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  private event(before: Payslip | null, after: Payslip | null, action: string) {
    const e: PayrollEvent = {
      id: randomUUID(),
      at: new Date().toISOString(),
      recordId: (after ?? before)!.id,
      action,
      before,
      after,
    };
    this.open()
      .prepare("INSERT INTO payroll_audit VALUES(?,?,?,?)")
      .run(e.id, e.recordId, e.at, JSON.stringify(e));
  }
  save(input: unknown, revision: number, photos: Uint8Array[] = []) {
    return this.transaction(revision, (s) => {
      const proposed = payrollSchema.parse(input),
        old = s.records.find((r) => r.id === proposed.id) ?? null;
      if (old?.deletedAt || proposed.deletedAt)
        throw Error("휴지통에서 복원한 뒤 수정하세요");
      const images = photos.map(imageData);
      const next = payrollSchema.parse({
        ...proposed,
        imageIds: [
          ...new Set([...proposed.imageIds, ...images.map((p) => p.id)]),
        ],
        createdAt: old?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (
        next.imageIds.some(
          (id) => !images.some((p) => p.id === id) && !this.image(id),
        )
      )
        throw Error("등록되지 않은 사진입니다");
      if (old && JSON.stringify({...old,updatedAt:""})===JSON.stringify({...next,updatedAt:""})) return;
      for (const p of images)
        this.open()
          .prepare("INSERT OR IGNORE INTO payroll_images VALUES(?,?,?)")
          .run(p.id, p.mime, p.bytes);
      this.open()
        .prepare(
          "INSERT INTO payroll_records VALUES(?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document",
        )
        .run(next.id, JSON.stringify(next));
      this.event(old, next, old ? "수정" : "등록");
    });
  }
  change(id: string, action: "delete" | "restore" | "purge", revision: number) {
    return this.transaction(revision, (s) => {
      const old = s.records.find((r) => r.id === id);
      if (!old) throw Error("명세서를 찾지 못했습니다");
      if (action === "purge") {
        if (!old.deletedAt)
          throw Error("휴지통 항목만 영구 삭제할 수 있습니다");
        this.privateBackup();
        const candidates = new Set([
          ...old.imageIds,
          ...s.audit
            .filter((e) => e.recordId === id)
            .flatMap((e) => [
              ...(e.before?.imageIds ?? []),
              ...(e.after?.imageIds ?? []),
            ]),
        ]);
        this.open().prepare("DELETE FROM payroll_records WHERE id=?").run(id);
        this.open()
          .prepare("DELETE FROM payroll_audit WHERE record_id=?")
          .run(id);
        const rest = this.read();
        const refs = new Set([
          ...rest.records.flatMap((r) => r.imageIds),
          ...rest.audit.flatMap((e) => [
            ...(e.before?.imageIds ?? []),
            ...(e.after?.imageIds ?? []),
          ]),
        ]);
        for (const photo of candidates)
          if (!refs.has(photo))
            this.open()
              .prepare("DELETE FROM payroll_images WHERE id=?")
              .run(photo);
        return;
      }
      if (
        (action === "delete" && old.deletedAt) ||
        (action === "restore" && !old.deletedAt)
      )
        throw Error("명세서 상태가 바뀌었습니다");
      const next = { ...old, updatedAt: new Date().toISOString() };
      if (action === "delete") next.deletedAt = next.updatedAt;
      else delete next.deletedAt;
      this.open()
        .prepare("UPDATE payroll_records SET document=? WHERE id=?")
        .run(JSON.stringify(next), id);
      this.event(old, next, action === "delete" ? "삭제" : "복원");
    });
  }
  archive() {
    const s = this.read();
    return {
      format: "FINO_PAYROLL_BACKUP_V1" as const,
      ...s,
      images: this.open()
        .prepare("SELECT id,bytes FROM payroll_images ORDER BY id")
        .all()
        .map((r) => ({
          id: String(r.id),
          data: Buffer.from(r.bytes as Uint8Array).toString("base64"),
        })),
    };
  }
  private privateBackup() {
    const dir = path.join(path.dirname(this.file), "backups");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(
      path.join(dir, `payroll-before-${Date.now()}-${randomUUID()}.json`),
      JSON.stringify(this.archive()),
      { mode: 0o600, flag: "wx" },
    );
  }
  restore(input: unknown, revision: number) {
    const backup = archiveSchema.parse(input);
    if (
      new Set(backup.records.map((r) => r.id)).size !== backup.records.length ||
      new Set(backup.audit.map((r) => r.id)).size !== backup.audit.length
    )
      throw Error("중복 급여 기록");
    const images = backup.images.map((p) => {
      if (!/^[A-Za-z0-9+/=]+$/.test(p.data)) throw Error("잘못된 사진");
      const image = imageData(Buffer.from(p.data, "base64"));
      if (image.id !== p.id) throw Error("사진 검증 실패");
      return image;
    });
    const ids = new Set(images.map((p) => p.id));
    if (
      new Set(images.map((p) => p.id)).size !== images.length ||
      [
        ...backup.records,
        ...backup.audit.flatMap((a) =>
          [a.before, a.after].filter((v): v is Payslip => !!v),
        ),
      ].some((r) => r.imageIds.some((id) => !ids.has(id)))
    )
      throw Error("급여 사진 참조가 일치하지 않습니다");
    return this.transaction(revision, () => {
      this.privateBackup();
      const db = this.open();
      db.exec(
        "DELETE FROM payroll_records;DELETE FROM payroll_images;DELETE FROM payroll_audit;",
      );
      for (const r of [...backup.records].reverse())
        db.prepare("INSERT INTO payroll_records VALUES(?,?)").run(
          r.id,
          JSON.stringify(r),
        );
      for (const i of images)
        db.prepare("INSERT INTO payroll_images VALUES(?,?,?)").run(
          i.id,
          i.mime,
          i.bytes,
        );
      for (const e of [...backup.audit].reverse())
        db.prepare("INSERT INTO payroll_audit VALUES(?,?,?,?)").run(
          e.id,
          e.recordId,
          e.at,
          JSON.stringify(e),
        );
    });
  }
  close() {
    this.db?.close();
    this.db = undefined;
  }
}
const host = globalThis as unknown as { payrollRepository?: PayrollRepository };
export const payrollRepository = (host.payrollRepository ??=
  new PayrollRepository());
