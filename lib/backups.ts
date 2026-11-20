import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
export async function backupState(data: unknown, label = "local") {
  const directory = path.join(process.cwd(), ".data", "backups");
  await mkdir(directory, { recursive: true });
  const name = `${label.replace(/[^\w-]/g, "_")}-${Date.now()}-${crypto.randomUUID()}.json`;
  await writeFile(path.join(directory, name), JSON.stringify(data), {
    mode: 0o600,
  });
  return name;
}
