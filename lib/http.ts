export function allowedOrigin(headers: Headers) {
  try {
    const origin = new URL(headers.get("origin") ?? "");
    return (
      origin.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) &&
      origin.host === headers.get("host")
    );
  } catch {
    return false;
  }
}
export function allowedHost(headers: Headers) {
  try {
    const raw = headers.get("host");
    if (!raw) return false;
    const url = new URL(`http://${raw}`);
    return (
      !url.username &&
      !url.password &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
