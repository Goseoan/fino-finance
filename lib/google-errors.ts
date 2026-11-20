/** Return only allowlisted guidance, never raw Google errors or request credentials. */
export function googleConnectionError(error: unknown): string {
  const failure = error as {
    response?: { data?: { error?: { errors?: { reason?: string }[]; details?: { reason?: string; metadata?: { service?: string } }[] } } };
  } | null;
  const apiError = failure?.response?.data?.error;
  if (
    apiError?.errors?.some((item) => item.reason === "accessNotConfigured") ||
    apiError?.details?.some((item) => item.reason === "SERVICE_DISABLED" && item.metadata?.service === "sheets.googleapis.com")
  ) {
    return "Google Sheets API가 비활성화되어 있습니다. OAuth 클라이언트를 만든 Google Cloud 프로젝트에서 Google Sheets API를 활성화한 뒤, 잠시 기다렸다가 실제 저장소 연결을 다시 누르세요. Google 로그인은 다시 하지 않아도 됩니다.";
  }
  if (error instanceof Error && error.message.startsWith("이미 Google")) return error.message;
  return "연결하지 못했습니다. OAuth 인증·Sheets API 활성화·복사본 편집 권한을 확인하세요. 기존 자료는 유지됩니다.";
}
