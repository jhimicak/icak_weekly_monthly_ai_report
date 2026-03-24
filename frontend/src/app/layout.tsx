import type { Metadata } from "next";
import "./globals.css";
import ToastContainer from "@/components/Toast";

export const metadata: Metadata = {
  title: "스마트 리포트 허브 | Smart Report Hub",
  description: "주간·월간 업무보고 웹 기반 관리 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <nav className="sticky top-0 z-50 px-6 py-3 flex items-center justify-between border-b"
          style={{ background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(12px)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "var(--accent)" }}>
              SR
            </div>
            <span className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
              스마트 리포트 허브
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <a href="/" className="hover:text-[var(--accent)] transition-colors px-3 py-1 rounded-md hover:bg-black/5">홈</a>
            <a href="/admin" className="hover:text-[var(--accent)] transition-colors px-3 py-1 rounded-md hover:bg-black/5">관리자</a>
          </div>
        </nav>
        <main className="px-4 py-6">{children}</main>
        <ToastContainer />
      </body>
    </html>
  );
}
