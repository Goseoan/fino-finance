export async function limitedBytes(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("빈 요청");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    size += r.value.length;
    if (size > limit) {
      await reader.cancel();
      throw Error("파일 크기 한도를 초과했습니다");
    }
    chunks.push(r.value);
  }
  return Buffer.concat(chunks, size);
}
export async function payrollForm(request: Request) {
  const bytes = await limitedBytes(request, 32 * 1024 * 1024);
  return new Response(bytes, {
    headers: { "Content-Type": request.headers.get("content-type") ?? "" },
  }).formData();
}
export function payrollError(e: unknown) {
  const conflict = e instanceof Error && e.message.includes("충돌");
  return Response.json(
    {
      error: conflict
        ? "저장 충돌: 명세서를 새로고침 후 다시 저장하세요."
        : "저장하지 못했습니다. 귀속월·금액 합계·사진 형식과 크기를 확인하세요. 입력 내용은 유지됩니다.",
    },
    { status: conflict ? 409 : 400 },
  );
}
