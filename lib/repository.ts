import { SQLiteRepository } from "./sqlite-repository";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";
import { State, stateSchema, seedState } from "./domain";
import { migrateSource } from "./migration";
import { backupState } from "./backups";
export interface Repository {
  read(): Promise<State>;
  update(fn: (s: State) => State): Promise<State>;
}
export class FileRepository implements Repository {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private file = path.join(
      process.cwd(),
      ".data",
      process.env.FINANCE_E2E ? "e2e.json" : "demo.json",
    ),
    private initial: () => Promise<State> = async () => seedState(),
  ) {}
  async read() {
    try {
      return stateSchema.parse(JSON.parse(await readFile(this.file, "utf8")));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return this.initial();
      throw e;
    }
  }
  async update(fn: (s: State) => State) {
    const operation = this.queue.then(async () => {
      const before = await this.read();
      const next = stateSchema.parse(fn(before));
      await backupState(before, "before-local-save");
      await mkdir(path.dirname(this.file), { recursive: true });
      const temp = `${this.file}.${crypto.randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(next), { mode: 0o600 });
      await rename(temp, this.file);
      const verified = await this.read();
      if (verified.revision !== next.revision) throw Error("저장 후 검증 실패");
      return verified;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
const globalRepo = globalThis as unknown as {
  financeSQLite?: SQLiteRepository;
  financeSQLiteDemo?: SQLiteRepository;
};
export const demoRepository = (globalRepo.financeSQLiteDemo ??=
  new SQLiteRepository(path.join(process.cwd(), ".data", "e2e.sqlite"), () =>
    seedState(),
  ));
export const localRepository = (globalRepo.financeSQLite ??=
  new SQLiteRepository(path.join(process.cwd(), ".data", "finance.sqlite")));
export const repository = process.env.FINANCE_E2E
  ? demoRepository
  : localRepository;
