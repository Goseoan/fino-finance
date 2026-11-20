import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FIN:O · 나의 금융 생활",
  description: "나를 위한 차분하고 명확한 자산관리",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
