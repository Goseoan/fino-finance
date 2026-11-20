import { readFile, writeFile, mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
export { ORIGINAL_ID } from "./sheets-document";
import { ORIGINAL_ID } from "./sheets-document";
export const COPY_ID = "";
export const privatePath = (name: string) =>
  path.join(
    process.cwd(),
    ".data",
    process.env.FINANCE_E2E ? `e2e-${name}` : name,
  );
const file = privatePath("google-connection.json");
export const configSchema = z.object({
  clientId: z.string().trim().min(5).max(300),
  clientSecret: z.string().min(5).max(1000),
  spreadsheetId: z
    .string()
    .regex(/^[\w-]+$/)
    .refine(
      (id) => id !== ORIGINAL_ID,
      "원본 시트는 쓰기 대상으로 사용할 수 없습니다",
    ),
  redirectUri: z
    .string()
    .url()
    .refine((v) => {
      const u = new URL(v);
      return (
        u.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) &&
        u.pathname === "/api/google/callback"
      );
    }, "로컬 앱 콜백 주소만 허용됩니다"),
});
export type GoogleConfig = z.infer<typeof configSchema> & {
  tokens?: {
    refresh_token?: string | null;
    access_token?: string | null;
    expiry_date?: number | null;
    scope?: string;
    token_type?: string | null;
  };
  enabled?: boolean;
  disabled?: boolean;
};
export async function writePrivate(name: string, data: unknown) {
  await mkdir(path.join(process.cwd(), ".data"), { recursive: true });
  const target = privatePath(name);
  const temp = `${target}.${crypto.randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(data), { mode: 0o600 });
  await rename(temp, target);
}
export async function readGoogleConfig(): Promise<GoogleConfig | null> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    if (process.env.FINANCE_E2E) return null;
    const {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REFRESH_TOKEN,
      GOOGLE_SPREADSHEET_ID,
    } = process.env;
    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
      return {
        ...configSchema.parse({
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          spreadsheetId: GOOGLE_SPREADSHEET_ID ?? COPY_ID,
          redirectUri:
            process.env.GOOGLE_REDIRECT_URI ??
            "http://127.0.0.1:3000/api/google/callback",
        }),
        tokens: { refresh_token: GOOGLE_REFRESH_TOKEN },
        enabled: false,
      };
    return null;
  }
}
export async function storeGoogleConfig(input: unknown) {
  const current = await readGoogleConfig();
  if (current?.enabled && !current.disabled)
    throw Error("연결을 해제한 뒤 설정을 변경하세요");
  const config = configSchema.parse(input);
  await writePrivate("google-connection.json", { ...config, enabled: false });
  return config;
}
export async function googleClient(config?: GoogleConfig) {
  const c = config ?? (await readGoogleConfig());
  if (!c || c.disabled) throw Error("Google 연결 설정이 필요합니다");
  const auth = new google.auth.OAuth2(
    c.clientId,
    c.clientSecret,
    c.redirectUri,
  );
  if (c.tokens) auth.setCredentials(c.tokens);
  return { auth, sheets: google.sheets({ version: "v4", auth }), config: c };
}
export function validOAuthState(
  expected: string | undefined,
  received: string | null,
) {
  if (!expected || !received) return false;
  const a = Buffer.from(expected),
    b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function disconnectGoogle() {
  const c = await readGoogleConfig();
  if (c)
    await writePrivate("google-connection.json", {
      ...c,
      tokens: undefined,
      enabled: false,
      disabled: true,
    });
}
export async function enableGoogle() {
  const config = await readGoogleConfig();
  if (!config) throw Error("연결 설정이 없습니다");
  await writePrivate("google-connection.json", {
    ...config,
    enabled: true,
    disabled: false,
  });
}
