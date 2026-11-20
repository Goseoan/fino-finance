import { NextRequest, NextResponse } from "next/server";
import { googleClient, writePrivate } from "@/lib/google-connection";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const { auth, config } = await googleClient();
    if (new URL(config.redirectUri).host !== req.headers.get("host"))
      throw Error("콜백 주소가 현재 앱 주소와 다릅니다");
    const state = crypto.randomUUID();
    const verifier = await auth.generateCodeVerifierAsync();
    await writePrivate("oauth-pending.json", {
      state,
      verifier: verifier.codeVerifier,
      expiresAt: Date.now() + 600000,
    });
    const response = NextResponse.redirect(
      auth.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: ["https://www.googleapis.com/auth/spreadsheets"],
        state,
        code_challenge: verifier.codeChallenge,
        code_challenge_method: "S256" as never,
      }),
    );
    response.cookies.set("fino-oauth-state", state, {
      httpOnly: true,
      sameSite: "lax",
      path: "/api/google/callback",
      maxAge: 600,
    });
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/connect?oauth=setup-required", req.url),
    );
  }
}
