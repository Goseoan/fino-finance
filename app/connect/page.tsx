import { GoogleConnectionPanel } from "@/components/google-connection-panel";
export default function Page() {
  return (
    <main className="connection-page">
      <a href="/">← 자산관리 앱으로 돌아가기</a>
      <GoogleConnectionPanel />
    </main>
  );
}
