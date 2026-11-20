import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  chmodSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { State, stateSchema, seedState } from "./domain";
import { migrateSource } from "./migration";

export function emptyState(): State {
  const s = seedState();
  return stateSchema.parse({
    ...s,
    revision: 0,
    mode: "local",
    assets: [],
    expenses: [],
    loans: [],
    snapshots: [],
    assetHistory: [],
    history: [],
    audit: [],
    trash: [],
    settings: { income: 0, annualIncome: 0, currency: "KRW" },
    updatedAt: new Date().toISOString(),
  });
}
export function legacyState(directory: string): State {
  const candidates = ["actual.json", "sqlite-migration-source.json"]
    .filter((n) =>
      existsSync(
        /* turbopackIgnore: true */ path.join(
          /* turbopackIgnore: true */ directory,
          n,
        ),
      ),
    )
    .map((n) =>
      stateSchema.parse(
        JSON.parse(
          readFileSync(
            /* turbopackIgnore: true */ path.join(
              /* turbopackIgnore: true */ directory,
              n,
            ),
            "utf8",
          ),
        ),
      ),
    );
  if (candidates.length) {
    candidates.sort((a, b) => b.revision - a.revision);
    const best = candidates[0];
    const normalize = (s: State) => JSON.stringify({ ...s, mode: "local" });
    for (const s of candidates)
      if (s.revision === best.revision && normalize(s) !== normalize(best))
        throw Error(
          "같은 버전의 이관 자료가 서로 다릅니다. 원본을 확인해야 합니다.",
        );
    return { ...best, mode: "local" };
  }
  const source = path.join(directory, "source.json");
  if (existsSync(source))
    return {
      ...migrateSource(JSON.parse(readFileSync(source, "utf8"))),
      mode: "local",
    };
  return emptyState();
}
/** Atomic SQLite state + indexed item/observation/journal projections. JSON preserves every optional field and array order. */
export class SQLiteRepository {
  private db?: DatabaseSync;
  constructor(
    private file: string,
    private initial: () => State = () => legacyState(path.dirname(file)),
  ) {}
  private open() {
    if (this.db) return this.db;
    const directory = path.dirname(this.file);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(this.file);
    chmodSync(this.file, 0o600);
    db.exec(
      "PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;",
    );
    const version = (
      db.prepare("PRAGMA user_version").get() as { user_version: number }
    ).user_version;
    if (version > 1) {
      db.close();
      throw Error("지원하지 않는 DB 버전입니다");
    }
    if (version === 0)
      db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)));
      CREATE TABLE IF NOT EXISTS items(kind TEXT NOT NULL, id TEXT NOT NULL, ordinal INTEGER NOT NULL, category TEXT, active INTEGER NOT NULL, document TEXT NOT NULL, PRIMARY KEY(kind,id));
      CREATE INDEX IF NOT EXISTS items_category ON items(kind,category,active);
      CREATE TABLE IF NOT EXISTS observations(source TEXT NOT NULL, date TEXT NOT NULL, asset_id TEXT NOT NULL, value INTEGER NOT NULL, PRIMARY KEY(source,date,asset_id));
      CREATE INDEX IF NOT EXISTS observations_asset_date ON observations(asset_id,date);
      CREATE TABLE IF NOT EXISTS journal(id TEXT PRIMARY KEY, ordinal INTEGER NOT NULL, at TEXT NOT NULL, entity TEXT, item_id TEXT, document TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS journal_item ON journal(entity,item_id,at);
      CREATE TABLE IF NOT EXISTS storage_info(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS transfers(id TEXT PRIMARY KEY, at TEXT NOT NULL, revision INTEGER NOT NULL, remote_revision INTEGER NOT NULL);
      PRAGMA user_version=1; COMMIT;`);
    this.db = db;
    if (!db.prepare("SELECT id FROM state WHERE id=1").get()) {
      try {
        const initial = stateSchema.parse(this.initial());
        db.exec("BEGIN IMMEDIATE");
        if (!db.prepare("SELECT id FROM state WHERE id=1").get()) {
          this.backup(initial, "migration");
          this.write(initial);
          db.prepare(
            "INSERT OR REPLACE INTO storage_info VALUES('migration',?)",
          ).run(
            JSON.stringify({
              at: new Date().toISOString(),
              hash: createHash("sha256")
                .update(JSON.stringify(initial))
                .digest("hex"),
            }),
          );
          if (JSON.stringify(this.readSync()) !== JSON.stringify(initial))
            throw Error("이관 검증 실패");
        }
        db.exec("COMMIT");
      } catch (e) {
        if (db.isTransaction) db.exec("ROLLBACK");
        this.db = undefined;
        db.close();
        throw e;
      }
    }
    for (const suffix of ["-wal", "-shm"])
      if (existsSync(this.file + suffix)) chmodSync(this.file + suffix, 0o600);
    return db;
  }
  private backup(state: State, label: string) {
    const dir = path.join(path.dirname(this.file), "backups");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(
      path.join(dir, `sqlite-${label}-${Date.now()}-${randomUUID()}.json`),
      JSON.stringify(state),
      { mode: 0o600, flag: "wx" },
    );
  }
  private readSync(): State {
    const row = this.open()
      .prepare("SELECT document FROM state WHERE id=1")
      .get() as { document: string };
    return stateSchema.parse(JSON.parse(row.document));
  }
  private write(s: State) {
    const db = this.open();
    db.prepare(
      "INSERT INTO state VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision, document=excluded.document",
    ).run(s.revision, JSON.stringify(s));
    db.exec(
      "DELETE FROM items; DELETE FROM observations; DELETE FROM journal;",
    );
    const item = db.prepare("INSERT INTO items VALUES(?,?,?,?,?,?)");
    for (const [kind, rows] of [
      ["asset", s.assets],
      ["expense", s.expenses],
      ["loan", s.loans],
    ] as const)
      rows.forEach((r, i) =>
        item.run(
          kind,
          r.id,
          i,
          "category" in r ? r.category : null,
          Number(r.active),
          JSON.stringify(r),
        ),
      );
    const point = db.prepare("INSERT INTO observations VALUES(?,?,?,?)");
    for (const [source, records] of [
      ["snapshot", s.snapshots],
      ["imported", s.assetHistory ?? []],
    ] as const)
      for (const r of records)
        for (const [id, value] of Object.entries(r.values))
          point.run(source, r.date, id, value);
    const journal = db.prepare("INSERT INTO journal VALUES(?,?,?,?,?,?)");
    s.audit.forEach((r, i) =>
      journal.run(
        r.id,
        i,
        r.at,
        r.itemChange?.entity ?? (r.assetId ? "asset" : null),
        r.itemChange?.itemId ?? r.assetId ?? null,
        JSON.stringify(r),
      ),
    );
  }
  async read() {
    return this.readSync();
  }
  async update(fn: (s: State) => State) {
    const db = this.open();
    db.exec("BEGIN IMMEDIATE");
    try {
      const before = this.readSync(),
        next = stateSchema.parse(fn(before));
      if (JSON.stringify(before) !== JSON.stringify(next)) {
        this.backup(before, "before-save");
        this.write(next);
      }
      const verified = this.readSync();
      if (JSON.stringify(verified) !== JSON.stringify(next))
        throw Error("DB 저장 검증 실패");
      db.exec("COMMIT");
      return verified;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  transfer(id: string) {
    return this.open()
      .prepare("SELECT at,revision,remote_revision FROM transfers WHERE id=?")
      .get(id);
  }
  lastTransfer() {
    return (
      this.open()
        .prepare(
          "SELECT at,revision,remote_revision FROM transfers ORDER BY rowid DESC LIMIT 1",
        )
        .get() ?? null
    );
  }
  recordTransfer(id: string, revision: number, remoteRevision: number) {
    this.open()
      .prepare("INSERT OR IGNORE INTO transfers VALUES(?,?,?,?)")
      .run(id, new Date().toISOString(), revision, remoteRevision);
  }
  integrity() {
    return this.open().prepare("PRAGMA integrity_check").get();
  }
  close() {
    this.db?.close();
    this.db = undefined;
  }
}
