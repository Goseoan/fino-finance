export function moneyDigits(value: string): string {
  return value.replace(/,/g, "");
}
export function formatMoneyInput(
  value: string | number | null | undefined,
): string {
  if (value == null || (typeof value === "number" && Number.isNaN(value)))
    return "";
  const raw = moneyDigits(String(value));
  return /^\d+$/.test(raw) ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : raw;
}
export function moneyCaret(formatted: string, digitsBefore: number): number {
  if (digitsBefore <= 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++count === digitsBefore) return i + 1;
  }
  return formatted.length;
}
