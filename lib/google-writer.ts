import { open, mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { privatePath } from "./google-connection";
export const WRITER_METADATA_ID = 1179209295;
export const WRITER_METADATA_KEY = "fino_single_writer_v1";
export async function installationWriter() {
  const file = privatePath("installation-id");
  await mkdir(path.dirname(file), { recursive: true });
  try {
    const id = await readFile(file, "utf8");
    if (!/^[\w-]{10,100}$/.test(id)) throw Error("설치 ID 파일을 확인하세요");
    return id;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    const id = crypto.randomUUID();
    const handle = await open(file, "wx", 0o600);
    try {
      await handle.writeFile(id);
    } finally {
      await handle.close();
    }
    return id;
  }
}
export type WriterLock = <T>(key: string, fn: () => Promise<T>) => Promise<T>;
export const withWriterLock: WriterLock = async (key, fn) => {
  if (!/^[\w-]+$/.test(key)) throw Error("잘못된 저장소 ID");
  const file = privatePath(`google-writer-${key}.lock`);
  await mkdir(path.dirname(file), { recursive: true });
  let handle;
  try {
    handle = await open(file, "wx", 0o600);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST")
      throw Error(
        "쓰기 충돌: 다른 앱 프로세스가 저장 중입니다. 비정상 종료 후에도 계속되면 모든 앱을 종료하고 README의 잠금 복구 절차를 확인하세요.",
      );
    throw e;
  }
  try {
    await handle.writeFile(
      JSON.stringify({ pid: process.pid, at: new Date().toISOString() }),
    );
    return await fn();
  } finally {
    await handle.close();
    await unlink(file);
  }
};
