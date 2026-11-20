import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { imageData } from "./payroll-repository";
import { payrollSuggestions, type OCRLine } from "./payroll";
const exec = promisify(execFile);
export async function recognizePayroll(bytes: Uint8Array) {
  if (process.platform !== "darwin")
    throw Error("이 기기에서는 사진 자동 읽기를 지원하지 않습니다");
  const image = imageData(bytes);
  const dir = await mkdtemp(
    path.join(process.env.TMPDIR ?? "/tmp", "fino-payroll-"),
  );
  try {
    await writeFile(
      path.join(
        dir,
        "image-1" +
          (image.mime === "image/jpeg"
            ? ".jpg"
            : image.mime === "image/png"
              ? ".png"
              : ".webp"),
      ),
      image.bytes,
      { mode: 0o600 },
    );
    await exec(
      "/usr/bin/swift",
      [path.join(process.cwd(), "scripts", "payroll-ocr.swift"), dir],
      { timeout: 120000, maxBuffer: 1024 * 1024 },
    );
    const rows = JSON.parse(
      await readFile(
        /* turbopackIgnore: true */ path.join(dir, "ocr.json"),
        "utf8",
      ),
    ) as { lines: OCRLine[] }[];
    return payrollSuggestions(rows[0]?.lines ?? []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
