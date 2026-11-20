import { NextRequest, NextResponse } from "next/server";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  googleClient,
  validOAuthState,
  writePrivate,
  privatePath,
} from "@/lib/google-connection";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const state = req.nextUrl.searchParams.get("state");
    const pending = JSON.parse(
      await readFile(privatePath("oauth-pending.json"), "utf8"),
    );
    if (
      !validOAuthState(req.cookies.get("fino-oauth-state")?.value, state) ||
      !validOAuthState(pending.state, state) ||
      pending.expiresAt < Date.now()
    )
      throw Error("인증 상태 검증 실패");
    await unlink(privatePath("oauth-pending.json"));
    const code = req.nextUrl.searchParams.get("code");
    if (!code || req.nextUrl.searchParams.get("error"))
      throw Error("인증이 취소되었습니다");
    const { auth, config } = await googleClient();
    const { tokens } = await auth.getToken({
      code,
      codeVerifier: pending.verifier,
      redirect_uri: config.redirectUri,
    });
    if (
      !tokens.scope
        ?.split(" ")
        .includes("https://www.googleapis.com/auth/spreadsheets")
    )
      throw Error("Sheets 쓰기 권한이 필요합니다");
    if (!tokens.refresh_token && !config.tokens?.refresh_token)
      throw Error("오프라인 인증 토큰을 받지 못했습니다");
    await writePrivate("google-connection.json", {
      ...config,
      tokens: { ...config.tokens, ...tokens },
      enabled: false,
      disabled: false,
    });
    const res = NextResponse.redirect(
      new URL("/connect?oauth=success", req.url),
    );
    res.cookies.set("fino-oauth-state", "", {
      path: "/api/google/callback",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
    });
    return res;
  } catch {
    const res = NextResponse.redirect(
      new URL("/connect?oauth=failed", req.url),
    );
    res.cookies.set("fino-oauth-state", "", {
      path: "/api/google/callback",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
    });
    return res;
  }
}
