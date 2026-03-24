"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

let globalPush: ((t: ToastType, m: string) => void) | null = null;

/** 어디서든 호출 가능한 명령형 토스트 함수 */
export function toast(type: ToastType, message: string) {
  globalPush?.(type, message);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    globalPush = (type, message) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        3500
      );
    };
    return () => { globalPush = null; };
  }, []);

  const dismiss = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  const iconAndColor = (type: ToastType) => {
    if (type === "success") return { icon: <CheckCircle size={16} />, color: "var(--success)" };
    if (type === "error")   return { icon: <AlertCircle size={16} />, color: "var(--danger)" };
    return { icon: <CheckCircle size={16} />, color: "var(--accent)" };
  };

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const { icon, color } = iconAndColor(t.type);
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl border"
            style={{
              background: "var(--bg-card)",
              borderColor: `${color}44`,
              color: "var(--text-primary)",
              animation: "slideInRight 0.2s ease-out",
            }}
          >
            <span style={{ color }}>{icon}</span>
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="ml-2 opacity-60 hover:opacity-100"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
